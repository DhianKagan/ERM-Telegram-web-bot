"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearRouteCache = void 0;
exports.validateCoords = validateCoords;
exports.getRouteDistance = getRouteDistance;
exports.table = table;
exports.nearest = nearest;
exports.match = match;
exports.trip = trip;
exports.buildCacheKey = buildCacheKey;
// Назначение: запросы к сервису OSRM
// Модули: fetch, config, prom-client
const config_1 = require("../config");
const metrics_1 = require("../metrics");
const trace_1 = require("../utils/trace");
const cache_1 = require("../utils/cache");
const tableGuard = process.env.ROUTE_TABLE_GUARD !== '0';
const defaultTableMaxPoints = 100;
let tableMaxPoints = Number(process.env.ROUTE_TABLE_MAX_POINTS || defaultTableMaxPoints);
if (!Number.isFinite(tableMaxPoints) || tableMaxPoints <= 0) {
    console.warn(`ROUTE_TABLE_MAX_POINTS должен быть положительным. Используется значение по умолчанию ${defaultTableMaxPoints}`);
    tableMaxPoints = defaultTableMaxPoints;
}
const defaultTableMinInterval = 200;
let tableMinInterval = Number(process.env.ROUTE_TABLE_MIN_INTERVAL_MS || defaultTableMinInterval);
if (!Number.isFinite(tableMinInterval) || tableMinInterval <= 0) {
    console.warn(`ROUTE_TABLE_MIN_INTERVAL_MS должен быть положительным. Используется значение по умолчанию ${defaultTableMinInterval}`);
    tableMinInterval = defaultTableMinInterval;
}
let tableLastCall = 0;
const routingUrlObject = new URL(config_1.routingUrl);
const routePathSegments = routingUrlObject.pathname
    .split('/')
    .filter((segment) => segment.length > 0);
const routeSegmentIndex = routePathSegments.lastIndexOf('route');
const buildEndpointUrl = (endpoint) => {
    const parts = routeSegmentIndex === -1
        ? [...routePathSegments, endpoint]
        : [
            ...routePathSegments.slice(0, routeSegmentIndex),
            endpoint,
            ...routePathSegments.slice(routeSegmentIndex + 1),
        ];
    const normalized = parts.filter((segment) => segment.length > 0);
    const pathname = normalized.length ? `/${normalized.join('/')}` : '/';
    return new URL(pathname, `${routingUrlObject.origin}/`);
};
const allowed = ['table', 'nearest', 'match', 'trip', 'route'];
/** Проверка формата координат */
function validateCoords(value) {
    const coordRx = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?(;-?\d+(\.\d+)?,-?\d+(\.\d+)?)*$/;
    if (!coordRx.test(value))
        throw new Error('Некорректные координаты');
    return value;
}
async function call(endpoint, coords, params = {}) {
    if (!allowed.includes(endpoint))
        throw new Error('Неизвестный эндпойнт');
    const safeCoords = validateCoords(coords);
    const url = buildEndpointUrl(endpoint);
    url.searchParams.append(endpoint === 'nearest' ? 'point' : 'points', safeCoords);
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const timer = metrics_1.osrmRequestDuration.startTimer({ endpoint });
    try {
        const res = await fetch(url, { headers, signal: controller.signal });
        const data = await res.json();
        if (!res.ok) {
            metrics_1.osrmErrorsTotal.inc({ endpoint, reason: String(res.status) });
            throw new Error(data.message || data.code || 'Route error');
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
    const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
    const key = buildCacheKey('route', coords, {});
    const cached = await (0, cache_1.cacheGet)(key);
    if (cached)
        return cached;
    const routeBase = buildEndpointUrl('route');
    const routeUrl = new URL(routeBase.toString());
    const normalizedPath = routeUrl.pathname.replace(/\/+$/, '');
    routeUrl.pathname = `${normalizedPath}/${coords}`;
    routeUrl.searchParams.set('overview', 'false');
    routeUrl.searchParams.set('annotations', 'distance');
    routeUrl.searchParams.set('steps', 'false');
    const trace = (0, trace_1.getTrace)();
    const headers = {};
    if (trace)
        headers.traceparent = trace.traceparent;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const timer = metrics_1.osrmRequestDuration.startTimer({ endpoint: 'route' });
    try {
        const res = await fetch(routeUrl, { headers, signal: controller.signal });
        const data = await res.json();
        if (!res.ok || data.code !== 'Ok') {
            metrics_1.osrmErrorsTotal.inc({ endpoint: 'route', reason: String(res.status) });
            throw new Error(data.message || data.code || 'Route error');
        }
        timer({ endpoint: 'route', status: res.status });
        const result = {
            distance: data.routes?.[0]?.distance,
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
/** Сборка ключа кеша */
function buildCacheKey(endpoint, coords, params) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params).sort())
        search.append(k, String(v));
    return `${endpoint}:${coords}:${search.toString()}`;
}
/** Очистка кеша маршрутов */
exports.clearRouteCache = cache_1.cacheClear;
