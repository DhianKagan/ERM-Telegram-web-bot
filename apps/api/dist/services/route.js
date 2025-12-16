"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearRouteCache = void 0;
exports.validateCoords = validateCoords;
exports.normalizePointsString = normalizePointsString;
exports.haversineDistanceMeters = haversineDistanceMeters;
exports.getRouteDistance = getRouteDistance;
exports.routeGeometry = routeGeometry;
exports.table = table;
exports.nearest = nearest;
exports.match = match;
exports.trip = trip;
exports.buildCacheKey = buildCacheKey;
const config_1 = require("../config");
const metrics_1 = require("../metrics");
const trace_1 = require("../utils/trace");
const cache_1 = require("../utils/cache");
const wgLogEngine_1 = require("../services/wgLogEngine");
const tableGuard = process.env.ROUTE_TABLE_GUARD !== '0';
const defaultTableMaxPoints = 100;
let tableMaxPoints = Number(process.env.ROUTE_TABLE_MAX_POINTS || defaultTableMaxPoints);
if (!Number.isFinite(tableMaxPoints) || tableMaxPoints <= 0) {
    tableMaxPoints = defaultTableMaxPoints;
}
const defaultTableMinInterval = 200;
let tableMinInterval = Number(process.env.ROUTE_TABLE_MIN_INTERVAL_MS || defaultTableMinInterval);
if (!Number.isFinite(tableMinInterval) || tableMinInterval <= 0) {
    tableMinInterval = defaultTableMinInterval;
}
let tableLastCall = 0;
const routingUrlObject = new URL(config_1.routingUrl);
const routePathSegments = routingUrlObject.pathname
    .split('/')
    .filter((segment) => segment.length > 0);
const routeSegmentIndex = routePathSegments.lastIndexOf('route');
const routePrefixSegments = routeSegmentIndex === -1
    ? routePathSegments
    : routePathSegments.slice(0, routeSegmentIndex);
const routeProfileSegments = routeSegmentIndex === -1
    ? []
    : routePathSegments.slice(routeSegmentIndex + 1);
const buildEndpointUrl = (endpoint, coords) => {
    const parts = [
        ...routePrefixSegments,
        endpoint,
        ...routeProfileSegments,
        ...(coords ? [coords] : []),
    ];
    const normalized = parts.filter((segment) => segment.length > 0);
    const pathname = normalized.length ? `/${normalized.join('/')}` : '/';
    return new URL(pathname, `${routingUrlObject.origin}/`);
};
const allowed = ['table', 'nearest', 'match', 'trip', 'route'];
function validateCoords(value) {
    const coordRx = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?(;-?\d+(\.\d+)?,-?\d+(\.\d+)?)*$/;
    if (!coordRx.test(value))
        throw new Error('Некорректные координаты');
    return value;
}
function getProxyToken() {
    const t1 = process.env.GEOCODER_PROXY_TOKEN;
    if (t1 && t1.trim())
        return t1.trim();
    const t2 = process.env.PROXY_TOKEN;
    if (t2 && t2.trim())
        return t2.trim();
    return undefined;
}
/* ----------------------
   Normalization & checks
   ---------------------- */
const PRECISION_DECIMALS = Number(process.env.ROUTE_PRECISION_DECIMALS || '6'); // rounding decimals
const MAX_SEGMENT_M = Number(process.env.ROUTE_MAX_SEGMENT_M || '200000'); // 200 km default
function roundCoord(value, decimals = PRECISION_DECIMALS) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}
function isValidLat(lat) {
    return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}
function isValidLon(lon) {
    return Number.isFinite(lon) && lon >= -180 && lon <= 180;
}
function normalizePointsString(raw) {
    // accepts "lon,lat;lon2,lat2;..."
    const sep = raw.indexOf(';') >= 0 ? ';' : raw.indexOf('|') >= 0 ? '|' : ';';
    const parts = raw.split(sep);
    const out = [];
    for (let p of parts) {
        p = p.trim();
        if (!p)
            continue;
        const coords = p.split(',').map((s) => s.trim());
        if (coords.length !== 2)
            continue;
        const lon = Number(coords[0]);
        const lat = Number(coords[1]);
        if (!Number.isFinite(lon) || !Number.isFinite(lat))
            continue;
        if (!isValidLon(lon) || !isValidLat(lat))
            continue;
        // round
        const rl = roundCoord(lat);
        const rl0 = roundCoord(lon);
        // drop duplicates (consecutive)
        if (out.length > 0) {
            const [lastLon, lastLat] = out[out.length - 1];
            if (lastLon === rl0 && lastLat === rl)
                continue;
        }
        out.push([rl0, rl]);
    }
    return out;
}
/** Haversine */
function haversineDistanceMeters(a, b) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000; // m
    const dLat = toRad(b[1] - a[1]);
    const dLon = toRad(b[0] - a[0]);
    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);
    const sinDlat = Math.sin(dLat / 2);
    const sinDlon = Math.sin(dLon / 2);
    const aa = sinDlat * sinDlat + sinDlon * sinDlon * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    return R * c;
}
function precheckLocations(locations) {
    if (!locations || locations.length < 2) {
        return { ok: false, reason: 'too_few_points' };
    }
    // check segments
    for (let i = 0; i < locations.length - 1; i++) {
        const a = locations[i];
        const b = locations[i + 1];
        const d = haversineDistanceMeters(a, b);
        if (!Number.isFinite(d)) {
            return { ok: false, reason: 'invalid_segment', index: i };
        }
        if (d > MAX_SEGMENT_M) {
            return { ok: false, reason: 'segment_too_long', index: i, distanceMeters: d, maxSegmentM: MAX_SEGMENT_M };
        }
    }
    return { ok: true };
}
/* ----------------------
   Helper: mask headers for logs
   ---------------------- */
function maskHeaders(headers) {
    if (!headers)
        return undefined;
    const out = {};
    for (const k of Object.keys(headers)) {
        if (k.toLowerCase() === 'authorization')
            out[k] = '<REDACTED>';
        else
            out[k] = headers[k];
    }
    return out;
}
/* ----------------------
   Core: call(), getRouteDistance(), routeGeometry()
   ---------------------- */
async function call(endpoint, coords, params = {}) {
    if (!allowed.includes(endpoint))
        throw new Error('Неизвестный эндпойнт');
    // Normalize input coords first. If invalid, throw early.
    const locations = normalizePointsString(coords);
    if (locations.length < 2)
        throw new Error('Некорректные координаты после нормализации');
    const pre = precheckLocations(locations);
    if (!pre.ok) {
        // return a structure that the caller can interpret as no-route
        wgLogEngine_1.logger.warn({ reason: pre.reason, details: pre }, 'Precheck of locations failed');
        // we'll return an object that usually doesn't match expected shape - but callers will handle null
        return {};
    }
    // rebuild coords string from normalized way (lon,lat;lon2,lat2)
    const normalizedCoordsStr = locations.map((p) => `${p[0]},${p[1]}`).join(';');
    const safeCoords = normalizedCoordsStr;
    const url = buildEndpointUrl(endpoint, safeCoords);
    for (const [k, v] of Object.entries(params))
        url.searchParams.append(k, String(v));
    const key = buildCacheKey(endpoint, safeCoords, params);
    const cached = await (0, cache_1.cacheGet)(key);
    if (cached)
        return cached;
    const trace = (0, trace_1.getTrace)();
    const headers = {};
    if (trace)
        headers.traceparent = trace.traceparent;
    const proxyToken = getProxyToken();
    if (proxyToken)
        headers['X-Proxy-Token'] = proxyToken;
    const routeDebug = process.env.ROUTE_DEBUG === '1';
    if (routeDebug) {
        wgLogEngine_1.logger.info({ reqId: trace === null || trace === void 0 ? void 0 : trace.traceId, url: url.toString(), headers: maskHeaders(headers) }, 'Route: Calling upstream (debug)');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const timer = metrics_1.osrmRequestDuration.startTimer({ endpoint });
    try {
        const res = await fetch(url.toString(), { headers, signal: controller.signal });
        const raw = await res.text();
        // debug logging
        if (routeDebug) {
            const preview = typeof raw === 'string' && raw.length > 2000 ? raw.slice(0, 2000) + '...[truncated]' : raw;
            wgLogEngine_1.logger.info({ reqId: trace === null || trace === void 0 ? void 0 : trace.traceId, url: url.toString(), status: res.status, body: preview }, 'Route upstream response (debug)');
        }
        // try parse
        let data = null;
        try {
            data = raw ? JSON.parse(raw) : null;
        }
        catch (e) {
            wgLogEngine_1.logger.error({ reqId: trace === null || trace === void 0 ? void 0 : trace.traceId, url: url.toString(), status: res.status, body: raw }, 'Non-JSON response from routing service');
            throw new Error('Routing service returned non-JSON response');
        }
        if (!res.ok) {
            // log the upstream body and do not throw for 400/404 (graceful handling)
            wgLogEngine_1.logger.error({ reqId: trace === null || trace === void 0 ? void 0 : trace.traceId, url: url.toString(), status: res.status, body: data }, 'Routing service returned non-ok status');
            metrics_1.osrmErrorsTotal.inc({ endpoint, reason: String(res.status) });
            if (res.status === 400 || res.status === 404) {
                // cache the response for short time as well, to avoid storm
                await (0, cache_1.cacheSet)(key, data);
                return data;
            }
            throw new Error((data === null || data === void 0 ? void 0 : data.message) || (data === null || data === void 0 ? void 0 : data.code) || `Route error status ${res.status}`);
        }
        timer({ endpoint, status: res.status });
        await (0, cache_1.cacheSet)(key, data);
        return data;
    }
    catch (e) {
        metrics_1.osrmErrorsTotal.inc({
            endpoint,
            reason: e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'error',
        });
        timer({ endpoint, status: 0 });
        throw e;
    }
    finally {
        clearTimeout(timeout);
    }
}
async function getRouteDistance(start, end) {
    var _a, _b;
    const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
    // Normalize and precheck
    const locations = normalizePointsString(coords);
    if (locations.length < 2)
        return { distance: undefined };
    const pre = precheckLocations(locations);
    if (!pre.ok) {
        wgLogEngine_1.logger.warn({ pre }, 'getRouteDistance precheck failed');
        return { distance: undefined };
    }
    const normalizedCoordsStr = locations.map((p) => `${p[0]},${p[1]}`).join(';');
    const key = buildCacheKey('route', normalizedCoordsStr, {});
    const cached = await (0, cache_1.cacheGet)(key);
    if (cached)
        return cached;
    const routeUrl = buildEndpointUrl('route', normalizedCoordsStr);
    routeUrl.searchParams.set('overview', 'false');
    routeUrl.searchParams.set('annotations', 'distance');
    routeUrl.searchParams.set('steps', 'false');
    const trace = (0, trace_1.getTrace)();
    const headers = {};
    if (trace)
        headers.traceparent = trace.traceparent;
    const proxyToken = getProxyToken();
    if (proxyToken)
        headers['X-Proxy-Token'] = proxyToken;
    const routeDebug = process.env.ROUTE_DEBUG === '1';
    if (routeDebug) {
        wgLogEngine_1.logger.info({ reqId: trace === null || trace === void 0 ? void 0 : trace.traceId, url: routeUrl.toString(), headers: maskHeaders(headers) }, 'RouteDistance: calling upstream (debug)');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const timer = metrics_1.osrmRequestDuration.startTimer({ endpoint: 'route' });
    try {
        const res = await fetch(routeUrl.toString(), { headers, signal: controller.signal });
        const raw = await res.text();
        if (routeDebug) {
            const preview = typeof raw === 'string' && raw.length > 2000 ? raw.slice(0, 2000) + '...[truncated]' : raw;
            wgLogEngine_1.logger.info({ reqId: trace === null || trace === void 0 ? void 0 : trace.traceId, url: routeUrl.toString(), status: res.status, body: preview }, 'RouteDistance upstream response (debug)');
        }
        let data = null;
        try {
            data = raw ? JSON.parse(raw) : null;
        }
        catch (e) {
            wgLogEngine_1.logger.error({ reqId: trace === null || trace === void 0 ? void 0 : trace.traceId, url: routeUrl.toString(), status: res.status, body: raw }, 'Non-JSON response from routing service (route)');
            throw new Error('Routing service returned non-JSON response');
        }
        if (!res.ok || (data === null || data === void 0 ? void 0 : data.code) !== 'Ok') {
            wgLogEngine_1.logger.error({ reqId: trace === null || trace === void 0 ? void 0 : trace.traceId, url: routeUrl.toString(), status: res.status, body: data }, 'Routing service returned error for routeDistance');
            metrics_1.osrmErrorsTotal.inc({ endpoint: 'route', reason: String(res.status) });
            if (res.status === 400 || res.status === 404) {
                await (0, cache_1.cacheSet)(key, { distance: undefined });
                return { distance: undefined, waypoints: data === null || data === void 0 ? void 0 : data.waypoints };
            }
            throw new Error((data === null || data === void 0 ? void 0 : data.message) || (data === null || data === void 0 ? void 0 : data.code) || `Route error status ${res.status}`);
        }
        timer({ endpoint: 'route', status: res.status });
        const result = {
            distance: (_b = (_a = data.routes) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.distance,
            waypoints: data.waypoints,
        };
        await (0, cache_1.cacheSet)(key, result);
        return result;
    }
    catch (e) {
        metrics_1.osrmErrorsTotal.inc({
            endpoint: 'route',
            reason: e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'error',
        });
        timer({ endpoint: 'route', status: 0 });
        throw e;
    }
    finally {
        clearTimeout(timeout);
    }
}
async function routeGeometry(points, params = {}) {
    var _a, _b;
    const locations = normalizePointsString(points);
    if (locations.length < 2)
        return null;
    const pre = precheckLocations(locations);
    if (!pre.ok) {
        wgLogEngine_1.logger.warn({ pre, points }, 'routeGeometry precheck failed - returning null');
        return null;
    }
    const normalizedCoordsStr = locations.map((p) => `${p[0]},${p[1]}`).join(';');
    const data = await call('route', normalizedCoordsStr, {
        overview: 'full',
        geometries: 'geojson',
        ...params,
    });
    // If upstream returned an error body (400/404) the call() returned the raw data.
    if (!data || !data.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
        return null;
    }
    const geometry = (_b = (_a = data.routes) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.geometry;
    if (!geometry || !Array.isArray(geometry.coordinates)) {
        return null;
    }
    return geometry.coordinates;
}
async function table(points, params = {}) {
    if (tableGuard) {
        const count = points.split(';').length;
        if (count > tableMaxPoints)
            throw new Error('Слишком много точек');
        const now = Date.now();
        const diff = now - tableLastCall;
        if (diff < tableMinInterval)
            await new Promise((r) => setTimeout(r, tableMinInterval - diff));
        tableLastCall = Date.now();
    }
    return call('table', points, params);
}
async function nearest(point, params = {}) {
    return call('nearest', point, params);
}
async function match(points, params = {}) {
    return call('match', points, params);
}
async function trip(points, params = {}) {
    return call('trip', points, params);
}
function buildCacheKey(endpoint, coords, params) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params).sort())
        search.append(k, String(v));
    return `${endpoint}:${coords}:${search.toString()}`;
}
exports.clearRouteCache = cache_1.cacheClear;
