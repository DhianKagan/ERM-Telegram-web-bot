"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_SEGMENT_M = void 0;
exports.normalizePointsString = normalizePointsString;
exports.haversineDistanceMeters = haversineDistanceMeters;
exports.precheckLocations = precheckLocations;
exports.parsePointInput = parsePointInput;
exports.latLngToLonLat = latLngToLonLat;
// apps/api/src/utils/geo.ts
const shared_1 = require("shared");
const PRECISION_DECIMALS = Number(process.env.ROUTE_PRECISION_DECIMALS || '6');
exports.MAX_SEGMENT_M = Number(process.env.ROUTE_MAX_SEGMENT_M || '200000'); // default 200km
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
/**
 * Normalize points string "lon,lat;lon2,lat2;..." or with '|' separator.
 * Returns array of [lon, lat].
 */
function normalizePointsString(raw) {
    if (!raw || typeof raw !== 'string')
        return [];
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
        const rl = roundCoord(lat);
        const rl0 = roundCoord(lon);
        if (out.length > 0) {
            const [lastLon, lastLat] = out[out.length - 1];
            if (lastLon === rl0 && lastLat === rl)
                continue;
        }
        out.push([rl0, rl]);
    }
    return out;
}
/** Haversine — meters */
function haversineDistanceMeters(a, b) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000;
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
    for (let i = 0; i < locations.length - 1; i++) {
        const a = locations[i];
        const b = locations[i + 1];
        const d = haversineDistanceMeters(a, b);
        if (!Number.isFinite(d)) {
            return { ok: false, reason: 'invalid_segment', index: i };
        }
        if (d > exports.MAX_SEGMENT_M) {
            return {
                ok: false,
                reason: 'segment_too_long',
                index: i,
                distanceMeters: d,
                maxSegmentM: exports.MAX_SEGMENT_M,
            };
        }
    }
    return { ok: true };
}
/**
 * Parse an incoming point value to a LatLng object or null.
 * Delegates to shared.extractCoords for strings first (covers Google links).
 */
function parsePointInput(input) {
    var _a, _b, _c;
    if (input == null)
        return null;
    // If it's an object like { lat, lng } or { latitude, longitude }
    if (typeof input === 'object' && !Array.isArray(input)) {
        const obj = input;
        const maybeLatitude = (_a = obj.latitude) !== null && _a !== void 0 ? _a : obj.lat;
        const maybeLongitude = (_c = (_b = obj.longitude) !== null && _b !== void 0 ? _b : obj.lon) !== null && _c !== void 0 ? _c : obj.lng;
        const latN = Number(maybeLatitude);
        const lngN = Number(maybeLongitude);
        if (Number.isFinite(latN) && Number.isFinite(lngN) && isValidLat(latN) && isValidLon(lngN)) {
            return { lat: roundCoord(latN), lng: roundCoord(lngN) };
        }
        // Try swapped keys (lng, lat)
        const maybeLatitude2 = obj.lng;
        const maybeLongitude2 = obj.lat;
        const lat2 = Number(maybeLatitude2);
        const lng2 = Number(maybeLongitude2);
        if (Number.isFinite(lat2) && Number.isFinite(lng2) && isValidLat(lat2) && isValidLon(lng2)) {
            return { lat: roundCoord(lat2), lng: roundCoord(lng2) };
        }
        return null;
    }
    // If string — try shared.extractCoords first (Google links etc.)
    if (typeof input === 'string') {
        const s = input.trim();
        try {
            const maybe = (0, shared_1.extractCoords)(s);
            if (maybe && Number.isFinite(maybe.lat) && Number.isFinite(maybe.lng)) {
                return { lat: roundCoord(maybe.lat), lng: roundCoord(maybe.lng) };
            }
        }
        catch {
            // fallthrough to legacy parsing
        }
        // Try JSON string
        if (s.startsWith('{') && s.endsWith('}')) {
            try {
                const parsed = JSON.parse(s);
                return parsePointInput(parsed);
            }
            catch {
                // continue
            }
        }
        // Try "lon,lat" or "lat,lng"
        const parts = s.split(',').map((x) => x.trim());
        if (parts.length === 2) {
            const a = Number(parts[0]);
            const b = Number(parts[1]);
            if (Number.isFinite(a) && Number.isFinite(b)) {
                if (isValidLon(a) && isValidLat(b)) {
                    return { lat: roundCoord(b), lng: roundCoord(a) };
                }
                if (isValidLat(a) && isValidLon(b)) {
                    return { lat: roundCoord(a), lng: roundCoord(b) };
                }
            }
        }
        return null;
    }
    // If it's an array [a,b]
    if (Array.isArray(input) && input.length >= 2) {
        const a = Number(input[0]);
        const b = Number(input[1]);
        if (Number.isFinite(a) && Number.isFinite(b)) {
            if (isValidLat(a) && isValidLon(b)) {
                return { lat: roundCoord(a), lng: roundCoord(b) };
            }
            if (isValidLon(a) && isValidLat(b)) {
                return { lat: roundCoord(b), lng: roundCoord(a) };
            }
        }
        return null;
    }
    return null;
}
/**
 * Convert lat/lng object to [lon, lat] array
 */
function latLngToLonLat(input) {
    if (Array.isArray(input)) {
        return [Number(input[0]), Number(input[1])];
    }
    return [Number(input.lng), Number(input.lat)];
}
