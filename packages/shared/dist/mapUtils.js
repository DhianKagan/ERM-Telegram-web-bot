"use strict";
// Назначение: общие функции для работы с Google Maps.
// Модули: utils
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractCoords = extractCoords;
exports.generateRouteLink = generateRouteLink;
exports.generateMultiRouteLink = generateMultiRouteLink;
function extractCoords(url) {
    const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
        url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) {
        return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    }
    return null;
}
function generateRouteLink(start, end, mode = 'driving') {
    if (!start || !end)
        return '';
    return `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lng}&destination=${end.lat},${end.lng}&travelmode=${mode}`;
}
function generateMultiRouteLink(points = [], mode = 'driving') {
    if (!Array.isArray(points) || points.length < 2)
        return '';
    const pts = points.slice(0, 10);
    const origin = pts[0];
    const destination = pts[pts.length - 1];
    const waypoints = pts
        .slice(1, -1)
        .map((p) => `${p.lat},${p.lng}`)
        .join('|');
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=${mode}`;
    if (waypoints)
        url += `&waypoints=${waypoints}`;
    return url;
}
exports.default = { extractCoords, generateRouteLink, generateMultiRouteLink };
