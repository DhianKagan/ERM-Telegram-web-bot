"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractLegacyCoordinates = exports.syncTaskPoints = exports.normalizeTaskPoints = void 0;
const geo_1 = require("./geo");
const POINT_KINDS = ['start', 'via', 'finish'];
const normalizeText = (value) => {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
};
const normalizeCoordinates = (value) => {
    const parsed = (0, geo_1.parsePointInput)(value);
    return parsed !== null && parsed !== void 0 ? parsed : undefined;
};
const normalizePoint = (value, fallbackOrder) => {
    if (!value || typeof value !== 'object')
        return null;
    const raw = value;
    const kindRaw = normalizeText(raw.kind);
    if (!kindRaw || !POINT_KINDS.includes(kindRaw))
        return null;
    const coords = normalizeCoordinates(raw.coordinates);
    const orderValue = Number(raw.order);
    const order = Number.isFinite(orderValue) ? orderValue : fallbackOrder;
    const title = normalizeText(raw.title);
    const sourceUrl = normalizeText(raw.sourceUrl);
    return {
        order,
        kind: kindRaw,
        title: title !== null && title !== void 0 ? title : undefined,
        sourceUrl: sourceUrl !== null && sourceUrl !== void 0 ? sourceUrl : undefined,
        coordinates: coords,
    };
};
const normalizeTaskPoints = (value) => {
    if (!Array.isArray(value))
        return [];
    return value
        .map((item, index) => normalizePoint(item, index))
        .filter((item) => Boolean(item))
        .sort((a, b) => a.order - b.order)
        .map((item, index) => ({
        ...item,
        order: Number.isFinite(item.order) ? item.order : index,
    }));
};
exports.normalizeTaskPoints = normalizeTaskPoints;
const findByKind = (points, kinds) => points.find((point) => kinds.includes(point.kind));
const findLastByKind = (points, kinds) => {
    for (let i = points.length - 1; i >= 0; i -= 1) {
        if (kinds.includes(points[i].kind)) {
            return points[i];
        }
    }
    return undefined;
};
const buildFromLegacy = (start, finish, titles, sourceUrl) => {
    const result = [];
    if (start) {
        result.push({
            order: result.length,
            kind: 'start',
            coordinates: start,
            title: titles.start,
            sourceUrl,
        });
    }
    if (finish) {
        result.push({
            order: result.length,
            kind: 'finish',
            coordinates: finish,
            title: titles.finish,
            sourceUrl,
        });
    }
    return result;
};
const syncTaskPoints = (target) => {
    var _a, _b, _c, _d, _e;
    const hasPointsUpdate = Array.isArray(target.points);
    const normalizedPoints = hasPointsUpdate
        ? (0, exports.normalizeTaskPoints)(target.points)
        : [];
    const startLegacy = normalizeCoordinates(target.startCoordinates);
    const finishLegacy = normalizeCoordinates(target.finishCoordinates);
    if (hasPointsUpdate) {
        const startPoint = (_a = findByKind(normalizedPoints, ['start', 'via'])) !== null && _a !== void 0 ? _a : normalizedPoints[0];
        const finishPoint = (_b = findLastByKind(normalizedPoints, ['finish', 'via', 'start'])) !== null && _b !== void 0 ? _b : (normalizedPoints.length ? normalizedPoints[normalizedPoints.length - 1] : undefined);
        target.points = normalizedPoints;
        target.startCoordinates = (_c = startPoint === null || startPoint === void 0 ? void 0 : startPoint.coordinates) !== null && _c !== void 0 ? _c : null;
        target.finishCoordinates = (_d = finishPoint === null || finishPoint === void 0 ? void 0 : finishPoint.coordinates) !== null && _d !== void 0 ? _d : null;
        if (!target.start_location && (startPoint === null || startPoint === void 0 ? void 0 : startPoint.title)) {
            target.start_location = startPoint.title;
        }
        if (!target.end_location && (finishPoint === null || finishPoint === void 0 ? void 0 : finishPoint.title)) {
            target.end_location = finishPoint.title;
        }
        if (!target.google_route_url) {
            const sourceUrl = (_e = startPoint === null || startPoint === void 0 ? void 0 : startPoint.sourceUrl) !== null && _e !== void 0 ? _e : finishPoint === null || finishPoint === void 0 ? void 0 : finishPoint.sourceUrl;
            if (sourceUrl) {
                target.google_route_url = sourceUrl;
            }
        }
        return;
    }
    if (!startLegacy && !finishLegacy) {
        return;
    }
    const points = buildFromLegacy(startLegacy, finishLegacy, {
        start: normalizeText(target.start_location),
        finish: normalizeText(target.end_location),
    }, normalizeText(target.google_route_url));
    if (points.length) {
        target.points = points;
    }
    if (startLegacy) {
        target.startCoordinates = startLegacy;
    }
    if (finishLegacy) {
        target.finishCoordinates = finishLegacy;
    }
};
exports.syncTaskPoints = syncTaskPoints;
const extractLegacyCoordinates = (points) => {
    var _a, _b;
    if (!points || !points.length) {
        return {};
    }
    const normalized = (0, exports.normalizeTaskPoints)(points);
    const start = (_a = findByKind(normalized, ['start', 'via'])) !== null && _a !== void 0 ? _a : normalized[0];
    const finish = (_b = findLastByKind(normalized, ['finish', 'via', 'start'])) !== null && _b !== void 0 ? _b : (normalized.length ? normalized[normalized.length - 1] : undefined);
    return {
        start: start === null || start === void 0 ? void 0 : start.coordinates,
        finish: finish === null || finish === void 0 ? void 0 : finish.coordinates,
    };
};
exports.extractLegacyCoordinates = extractLegacyCoordinates;
