"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskPointsValidationError = void 0;
exports.prepareIncomingPoints = prepareIncomingPoints;
// apps/api/src/utils/taskPointsInput.ts
// Назначение: подготовка и валидация точек маршрута задач.
// Основные модули: utils/geo, utils/parseGoogleAddress, services/maps
const shared_1 = require("shared");
const geo_1 = require("./geo");
const parseGoogleAddress_1 = __importDefault(require("./parseGoogleAddress"));
const taskPoints_1 = require("./taskPoints");
const maps_1 = require("../services/maps");
const MAX_POINTS = 10;
const normalizeText = (value) => {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
};
class TaskPointsValidationError extends Error {
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
    }
}
exports.TaskPointsValidationError = TaskPointsValidationError;
const resolvePointCoordinates = (rawCoordinates, sourceUrl) => {
    var _a;
    const coords = (0, geo_1.parsePointInput)((_a = rawCoordinates !== null && rawCoordinates !== void 0 ? rawCoordinates : sourceUrl) !== null && _a !== void 0 ? _a : null);
    if (coords) {
        return coords;
    }
    if (sourceUrl) {
        const extracted = (0, shared_1.extractCoords)(sourceUrl);
        if (extracted) {
            return { lat: extracted.lat, lng: extracted.lng };
        }
    }
    return null;
};
async function prepareIncomingPoints(value) {
    if (!Array.isArray(value) || value.length === 0) {
        return [];
    }
    if (value.length > MAX_POINTS) {
        throw new TaskPointsValidationError('points_limit_exceeded', 'Количество точек не должно превышать 10', { max: MAX_POINTS });
    }
    const normalized = [];
    for (let i = 0; i < value.length; i += 1) {
        const rawPoint = value[i];
        if (!rawPoint || typeof rawPoint !== 'object') {
            throw new TaskPointsValidationError('invalid_point', `Точка ${i + 1} должна быть объектом с координатами`, { index: i });
        }
        const payload = rawPoint;
        const kind = normalizeText(payload.kind);
        if (!kind || !['start', 'via', 'finish'].includes(kind)) {
            throw new TaskPointsValidationError('invalid_point', `Некорректный тип точки ${i + 1}`, { index: i });
        }
        const orderRaw = Number(payload.order);
        const order = Number.isFinite(orderRaw) ? orderRaw : i;
        const sourceUrlRaw = normalizeText(payload.sourceUrl);
        let sourceUrl = sourceUrlRaw;
        if (sourceUrlRaw) {
            try {
                sourceUrl = await (0, maps_1.expandMapsUrl)(sourceUrlRaw);
            }
            catch (error) {
                throw new TaskPointsValidationError('invalid_point', `Не удалось обработать ссылку точки ${i + 1}`, { index: i, message: error.message });
            }
        }
        const coordinates = resolvePointCoordinates(payload.coordinates, sourceUrl);
        if (!coordinates) {
            throw new TaskPointsValidationError('invalid_point', `Некорректные координаты точки ${i + 1}`, { index: i });
        }
        const titleCandidate = normalizeText(payload.title);
        const title = titleCandidate !== null && titleCandidate !== void 0 ? titleCandidate : (sourceUrl ? (0, parseGoogleAddress_1.default)(sourceUrl) : undefined);
        normalized.push({
            order,
            kind: kind,
            sourceUrl: sourceUrl !== null && sourceUrl !== void 0 ? sourceUrl : undefined,
            coordinates,
            title: title !== null && title !== void 0 ? title : undefined,
        });
    }
    const points = (0, taskPoints_1.normalizeTaskPoints)(normalized);
    const coordsList = points.map((point) => (0, geo_1.latLngToLonLat)(point.coordinates));
    const precheck = (0, geo_1.precheckLocations)(coordsList);
    if (!precheck.ok) {
        throw new TaskPointsValidationError('invalid_segment', 'Маршрут содержит некорректные сегменты', precheck);
    }
    return points;
}
