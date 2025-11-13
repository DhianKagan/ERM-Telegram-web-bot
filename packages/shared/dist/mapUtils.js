"use strict";
// Назначение: общие функции для работы с Google Maps.
// Модули: utils
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractCoords = extractCoords;
exports.generateRouteLink = generateRouteLink;
exports.generateMultiRouteLink = generateMultiRouteLink;
const COORD_PAIR_PATTERN = /(-?\d+(?:\.\d+)?)[,\s+]+(-?\d+(?:\.\d+)?)/;
const NESTED_URL_KEYS = ['link', 'url', 'u'];
const MAX_NESTING_DEPTH = 3;
const parseCoordPair = (latRaw, lngRaw) => {
    const lat = Number.parseFloat(latRaw);
    const lng = Number.parseFloat(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }
    return { lat, lng };
};
const safeDecode = (value) => {
    let current = value;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const decoded = decodeURIComponent(current);
            if (decoded === current) {
                break;
            }
            current = decoded;
        }
        catch {
            break;
        }
    }
    return current;
};
const parseCombinedValue = (value) => {
    if (!value) {
        return null;
    }
    const decoded = safeDecode(value);
    const match = decoded.match(COORD_PAIR_PATTERN);
    if (!match) {
        return null;
    }
    return parseCoordPair(match[1], match[2]);
};
const looksLikeUrl = (value) => {
    if (!value) {
        return false;
    }
    try {
        const parsed = new URL(value, 'https://maps.google.com');
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    }
    catch {
        return false;
    }
};
const extractNestedCoords = (value, depth) => {
    if (!value || depth > MAX_NESTING_DEPTH) {
        return null;
    }
    const direct = parseCombinedValue(value);
    if (direct) {
        return direct;
    }
    const decoded = safeDecode(value);
    if (decoded !== value) {
        const decodedDirect = parseCombinedValue(decoded);
        if (decodedDirect) {
            return decodedDirect;
        }
    }
    if (!looksLikeUrl(decoded)) {
        return null;
    }
    return extractCoordsInternal(decoded, depth + 1);
};
const extractCoordsInternal = (url, depth = 0) => {
    if (!url || depth > MAX_NESTING_DEPTH) {
        return null;
    }
    try {
        const candidate = new URL(url, 'https://maps.google.com');
        const searchKeys = [
            'q',
            'query',
            'll',
            'center',
            'sll',
            'destination',
            'origin',
            'daddr',
            'saddr',
        ];
        for (const key of searchKeys) {
            const coords = parseCombinedValue(candidate.searchParams.get(key));
            if (coords) {
                return coords;
            }
        }
        for (const nestedKey of NESTED_URL_KEYS) {
            const coords = extractNestedCoords(candidate.searchParams.get(nestedKey), depth + 1);
            if (coords) {
                return coords;
            }
        }
        const hashCoords = parseCombinedValue(candidate.hash.replace(/^#/, ''));
        if (hashCoords) {
            return hashCoords;
        }
    }
    catch {
        // Пропускаем ошибки парсинга URL, пробуем регулярные выражения ниже.
    }
    const decoded = safeDecode(url);
    const bangMatch = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (bangMatch) {
        const coords = parseCoordPair(bangMatch[1], bangMatch[2]);
        if (coords) {
            return coords;
        }
    }
    const invertedBangMatch = decoded.match(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/);
    if (invertedBangMatch) {
        const coords = parseCoordPair(invertedBangMatch[2], invertedBangMatch[1]);
        if (coords) {
            return coords;
        }
    }
    const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (atMatch) {
        const coords = parseCoordPair(atMatch[1], atMatch[2]);
        if (coords) {
            return coords;
        }
    }
    if (decoded !== url && looksLikeUrl(decoded)) {
        return extractCoordsInternal(decoded, depth + 1);
    }
    return null;
};
function extractCoords(url) {
    if (!url) {
        return null;
    }
    return extractCoordsInternal(url);
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
