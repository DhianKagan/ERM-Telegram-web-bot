"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.geocodeAddresses = exports.geocodeAddress = void 0;
// Назначение: прямое геокодирование адресов в координаты для логистики
// Основные модули: config, fetch
const config_1 = require("../config");
const REQUEST_TIMEOUT_MS = 8000;
const normalizeAddress = (value) => {
    const trimmed = value.trim();
    return trimmed.replace(/\s+/g, ' ');
};
const parseCoordinate = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};
const geocodeAddress = async (address) => {
    var _a, _b, _c;
    if (!config_1.geocoderConfig.enabled || !config_1.geocoderConfig.baseUrl) {
        return null;
    }
    const normalized = normalizeAddress(address);
    if (!normalized) {
        return null;
    }
    const url = new URL(config_1.geocoderConfig.baseUrl);
    if (!url.searchParams.has('format')) {
        url.searchParams.set('format', 'json');
    }
    if (!url.searchParams.has('limit')) {
        url.searchParams.set('limit', '1');
    }
    url.searchParams.set('q', normalized);
    if (config_1.geocoderConfig.email) {
        url.searchParams.set('email', config_1.geocoderConfig.email);
    }
    const headers = {
        'User-Agent': config_1.geocoderConfig.userAgent,
    };
    if (config_1.geocoderConfig.email) {
        headers['X-Nominatim-Email'] = config_1.geocoderConfig.email;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, { headers, signal: controller.signal });
        if (!response.ok) {
            return null;
        }
        const payload = await response.json();
        const firstItem = Array.isArray(payload) ? payload[0] : payload;
        if (!firstItem) {
            return null;
        }
        const lat = parseCoordinate((_a = firstItem.lat) !== null && _a !== void 0 ? _a : firstItem.latitude);
        const lng = parseCoordinate((_c = (_b = firstItem.lon) !== null && _b !== void 0 ? _b : firstItem.lng) !== null && _c !== void 0 ? _c : firstItem.longitude);
        if (lat === null || lng === null) {
            return null;
        }
        return { lat, lng };
    }
    catch (error) {
        const isAbort = error instanceof Error && error.name === 'AbortError';
        const level = isAbort ? 'warn' : 'error';
        console[level]('Геокодер не вернул координаты', error instanceof Error ? error.message : error);
        return null;
    }
    finally {
        clearTimeout(timeout);
    }
};
exports.geocodeAddress = geocodeAddress;
const geocodeAddresses = async (addresses) => {
    const results = [];
    for (const item of addresses) {
        const coords = await (0, exports.geocodeAddress)(item);
        if (coords) {
            results.push(coords);
        }
    }
    return results;
};
exports.geocodeAddresses = geocodeAddresses;
