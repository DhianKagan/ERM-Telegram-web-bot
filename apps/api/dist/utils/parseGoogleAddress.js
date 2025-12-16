"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = parseGoogleAddress;
// apps/api/src/utils/parseGoogleAddress.ts
// Назначение: извлекает удобочитаемый адрес из ссылки Google Maps.
// Основные модули: shared/extractCoords
const shared_1 = require("shared");
const GOOGLE_LABEL_FALLBACK = 'Точка на карте';
const formatCoords = (coords) => {
    if (!coords) {
        return null;
    }
    const lat = Number.isFinite(coords.lat)
        ? coords.lat.toFixed(6)
        : String(coords.lat);
    const lng = Number.isFinite(coords.lng)
        ? coords.lng.toFixed(6)
        : String(coords.lng);
    return `${lat}, ${lng}`;
};
const isGoogleHost = (candidate) => {
    if (!candidate) {
        return false;
    }
    const host = candidate.toLowerCase();
    return (host.includes('google') ||
        host.endsWith('goo.gl') ||
        host.endsWith('maps.app') ||
        host.endsWith('maps.app.goo.gl'));
};
function parseGoogleAddress(url) {
    if (!url) {
        return url;
    }
    const coordsLabel = formatCoords((0, shared_1.extractCoords)(url));
    try {
        const place = url.match(/\/place\/([^/]+)/);
        if (place) {
            return decodeURIComponent(place[1].replace(/\+/g, ' ')).split(',')[0];
        }
        const q = url.match(/[?&]q=([^&]+)/);
        if (q) {
            return decodeURIComponent(q[1].replace(/\+/g, ' ')).split(',')[0];
        }
        const parsed = new URL(url);
        if (isGoogleHost(parsed.hostname)) {
            const searchLabel = parsed.searchParams.get('q');
            if (searchLabel) {
                return decodeURIComponent(searchLabel.replace(/\+/g, ' ')).split(',')[0];
            }
            if (coordsLabel) {
                return coordsLabel;
            }
            return GOOGLE_LABEL_FALLBACK;
        }
        return coordsLabel !== null && coordsLabel !== void 0 ? coordsLabel : url;
    }
    catch {
        return coordsLabel !== null && coordsLabel !== void 0 ? coordsLabel : url;
    }
}
