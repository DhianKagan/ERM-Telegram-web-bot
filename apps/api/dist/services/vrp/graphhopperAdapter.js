"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.__testing = void 0;
exports.buildTravelMatrix = buildTravelMatrix;
// Назначение: адаптер для получения матриц расстояний/времени из GraphHopper.
// Основные модули: config, fetch
const config_1 = require("../../config");
const EARTH_RADIUS_KM = 6371;
const toRadians = (value) => (value * Math.PI) / 180;
const haversineMeters = (a, b) => {
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h = sinLat * sinLat + sinLng * sinLng * Math.cos(lat1) * Math.cos(lat2);
    return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h))) * 1000);
};
const buildHaversineMatrix = (points) => points.map((from, fromIndex) => points.map((to, toIndex) => {
    if (fromIndex === toIndex) {
        return 0;
    }
    return haversineMeters(from, to);
}));
const toSecondsFromMeters = (distanceMeters, averageSpeedKmph) => {
    if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
        return 0;
    }
    const speed = Number.isFinite(averageSpeedKmph) && averageSpeedKmph > 0
        ? averageSpeedKmph
        : 30;
    return Math.max(0, Math.round((distanceMeters * 3.6) / speed));
};
const buildFallbackResult = (points, options, extraWarnings = []) => {
    const distanceMatrix = buildHaversineMatrix(points);
    const timeMatrix = distanceMatrix.map((row) => row.map((cell) => toSecondsFromMeters(cell, options.averageSpeedKmph)));
    return {
        provider: 'haversine',
        distanceMatrix,
        timeMatrix,
        warnings: extraWarnings,
    };
};
let customFetcher;
const getFetcher = () => {
    if (typeof customFetcher === 'function') {
        return customFetcher;
    }
    if (typeof fetch === 'function') {
        return (input, init) => fetch(input, init);
    }
    throw new Error('Глобальный fetch недоступен для вызова GraphHopper');
};
const sanitizeMatrix = (matrix, size) => {
    if (!Array.isArray(matrix)) {
        return Array.from({ length: size }, () => Array(size).fill(0));
    }
    return matrix.map((row, rowIndex) => {
        if (!Array.isArray(row)) {
            return Array(size).fill(0);
        }
        return row.map((value, columnIndex) => {
            if (rowIndex === columnIndex) {
                return 0;
            }
            const numeric = Number(value);
            return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
        });
    });
};
async function buildTravelMatrix(points, options) {
    var _a, _b, _c;
    if (!points.length) {
        return {
            provider: 'haversine',
            distanceMatrix: [],
            timeMatrix: [],
            warnings: ['Список точек пуст.'],
        };
    }
    if (!config_1.graphhopperConfig.matrixUrl) {
        return buildFallbackResult(points, options, [
            'GraphHopper отключён. Используем Haversine.',
        ]);
    }
    const fetcher = getFetcher();
    const url = new URL(config_1.graphhopperConfig.matrixUrl);
    if (config_1.graphhopperConfig.apiKey) {
        url.searchParams.set('key', config_1.graphhopperConfig.apiKey);
    }
    const controller = options.signal
        ? undefined
        : typeof AbortController === 'function'
            ? new AbortController()
            : undefined;
    let timeoutId;
    if (controller &&
        typeof options.timeoutMs === 'number' &&
        options.timeoutMs > 0) {
        timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
        (_a = timeoutId.unref) === null || _a === void 0 ? void 0 : _a.call(timeoutId);
    }
    try {
        const response = await fetcher(url.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                profile: config_1.graphhopperConfig.profile || 'car',
                points: points.map((point) => [point.lng, point.lat]),
                out_arrays: ['distances', 'times'],
            }),
            signal: (_b = options.signal) !== null && _b !== void 0 ? _b : controller === null || controller === void 0 ? void 0 : controller.signal,
        });
        if (!response.ok) {
            const message = `GraphHopper вернул статус ${response.status}`;
            return buildFallbackResult(points, options, [message]);
        }
        const payload = (await response.json());
        const size = points.length;
        const distanceMatrix = sanitizeMatrix(payload.distances, size);
        const timeMatrix = sanitizeMatrix(payload.times, size);
        const warnings = Array.isArray((_c = payload.info) === null || _c === void 0 ? void 0 : _c.messages)
            ? payload.info.messages.filter((item) => typeof item === 'string')
            : [];
        return {
            provider: 'graphhopper',
            distanceMatrix,
            timeMatrix,
            warnings,
        };
    }
    catch (error) {
        const reason = error instanceof Error ? error.message : 'Неизвестная ошибка GraphHopper';
        return buildFallbackResult(points, options, [
            `GraphHopper недоступен: ${reason}`,
        ]);
    }
    finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}
exports.__testing = {
    setFetcher(fetcher) {
        customFetcher = fetcher;
    },
};
