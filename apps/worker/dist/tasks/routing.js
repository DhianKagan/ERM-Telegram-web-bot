"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRouteDistance = void 0;
const logger_1 = require("../logger");
const geo_1 = require("../utils/geo");
const REQUEST_TIMEOUT_MS = Number(process.env.WORKER_ROUTE_TIMEOUT_MS || '30000'); // 30s default
const isValidPoint = (point) => {
    if (!point) {
        return false;
    }
    return Number.isFinite(point.lat) && Number.isFinite(point.lng);
};
const buildRouteUrl = (config, coordsStr) => {
    // Защита от случая, когда baseUrl отсутствует — в таком случае вызовы маршрутизации
    // не должны происходить (config.enabled должен быть false), но для безопасности
    // и корректности типов проверяем это явно.
    if (!config.baseUrl) {
        throw new Error('Routing baseUrl is not configured');
    }
    // Теперь compiler знает, что baseUrl — строка
    const base = new URL(config.baseUrl);
    const normalizedPath = base.pathname.replace(/\/+$/, '');
    base.pathname = `${normalizedPath}/${coordsStr}`;
    base.searchParams.set('overview', 'false');
    base.searchParams.set('annotations', 'distance');
    base.searchParams.set('steps', 'false');
    if (config.algorithm) {
        base.searchParams.set('algorithm', config.algorithm);
    }
    return base;
};
function normalizeWorkerPoint(input) {
    // Accept Coordinates object or string
    if (!input)
        return null;
    // If already object with lat/lng
    if (typeof input === 'object') {
        // try parse using parsePointInput
        const p = (0, geo_1.parsePointInput)(input);
        return p;
    }
    if (typeof input === 'string') {
        return (0, geo_1.parsePointInput)(input);
    }
    return null;
}
const calculateRouteDistance = async (startRaw, finishRaw, config) => {
    var _a, _b;
    if (!config.enabled) {
        return { distanceKm: null };
    }
    // Normalize inputs
    const startParsed = normalizeWorkerPoint(startRaw);
    const finishParsed = normalizeWorkerPoint(finishRaw);
    if (!startParsed || !finishParsed) {
        logger_1.logger.warn({ startRaw, finishRaw }, 'calculateRouteDistance: invalid raw coordinates after parse');
        return { distanceKm: null };
    }
    // use normalized lon,lat string for route
    const rawPoints = `${startParsed.lng},${startParsed.lat};${finishParsed.lng},${finishParsed.lat}`;
    const locations = (0, geo_1.normalizePointsString)(rawPoints);
    if (locations.length < 2) {
        logger_1.logger.warn({ startParsed, finishParsed }, 'calculateRouteDistance: normalized to fewer than 2 points');
        return { distanceKm: null };
    }
    const pre = (0, geo_1.precheckLocations)(locations);
    if (!pre.ok) {
        logger_1.logger.warn({ pre, startParsed, finishParsed }, 'calculateRouteDistance precheck failed');
        return { distanceKm: null };
    }
    const normalizedCoords = locations.map((p) => `${p[0]},${p[1]}`).join(';');
    // buildRouteUrl теперь безопасно проверяет наличие baseUrl
    let url;
    try {
        url = buildRouteUrl(config, normalizedCoords);
    }
    catch (err) {
        logger_1.logger.warn({ err, config }, 'calculateRouteDistance: routing baseUrl missing or invalid');
        return { distanceKm: null };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const headers = {};
        if (config.proxyToken)
            headers['X-Proxy-Token'] = config.proxyToken || '';
        // optional tracing
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { getTrace } = require('../utils/trace');
            const trace = getTrace && getTrace();
            if (trace && trace.traceparent) {
                headers['traceparent'] = trace.traceparent;
            }
        }
        catch {
            // ignore if tracing not available
        }
        const startTime = Date.now();
        const response = await fetch(url.toString(), { signal: controller.signal, headers });
        const raw = await response.text();
        let payload = null;
        try {
            payload = raw ? JSON.parse(raw) : null;
        }
        catch {
            logger_1.logger.warn({ url: url.toString(), status: response.status, raw: raw && raw.slice(0, 2000) + '...[truncated]' }, 'Worker: non-json response from routing service');
            return { distanceKm: null };
        }
        const durationMs = Date.now() - startTime;
        logger_1.logger.info({ url: url.toString(), durationMs, status: response.status }, 'Worker: route call');
        const asAny = payload;
        if (!response.ok || (asAny === null || asAny === void 0 ? void 0 : asAny.code) !== 'Ok') {
            logger_1.logger.warn({ status: response.status, payload: asAny }, 'OSRM returned error in worker');
            return { distanceKm: null };
        }
        const distanceMeters = (_b = (_a = asAny.routes) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.distance;
        if (typeof distanceMeters !== 'number') {
            return { distanceKm: null };
        }
        const distanceKm = Number((distanceMeters / 1000).toFixed(1));
        return { distanceKm };
    }
    catch (error) {
        const isAbort = error instanceof Error && error.name === 'AbortError';
        const level = isAbort ? 'warn' : 'error';
        logger_1.logger[level]({ start: startParsed, finish: finishParsed, error }, 'Unable to fetch route (worker)');
        return { distanceKm: null };
    }
    finally {
        clearTimeout(timeout);
    }
};
exports.calculateRouteDistance = calculateRouteDistance;
