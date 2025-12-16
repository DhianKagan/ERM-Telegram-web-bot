"use strict";
// Назначение: высокоуровневый клиент OSRM для вычисления дистанций
// Основные модули: services/route
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOsrmDistance = void 0;
const route_1 = require("../services/route");
const isValidPoint = (point) => {
    if (!point) {
        return false;
    }
    return Number.isFinite(point.lat) && Number.isFinite(point.lng);
};
const getOsrmDistance = async (params) => {
    const { start, finish } = params;
    if (!isValidPoint(start) || !isValidPoint(finish)) {
        return null;
    }
    try {
        const result = await (0, route_1.getRouteDistance)(start, finish);
        if (typeof result.distance !== 'number') {
            return null;
        }
        return Number((result.distance / 1000).toFixed(1));
    }
    catch {
        return null;
    }
};
exports.getOsrmDistance = getOsrmDistance;
