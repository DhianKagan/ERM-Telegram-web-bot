"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.mentioned = exports.remove = exports.summary = exports.bulk = exports.addTime = exports.update = exports.getById = exports.get = exports.create = void 0;
// Сервисные функции задач используют общие запросы к MongoDB
// Модули: db/queries, services/route, shared
const q = __importStar(require("../db/queries"));
const shared_1 = require("shared");
const osrm_1 = require("../geo/osrm");
const taskTypeSettings_1 = require("./taskTypeSettings");
const taskLinks_1 = require("./taskLinks");
const normalizeCompletedAt = (value) => {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const prepareTaskPayload = (input = {}) => {
    const { completed_at, ...rest } = input;
    const payload = {
        ...rest,
    };
    if (Object.prototype.hasOwnProperty.call(input, 'completed_at')) {
        payload.completed_at = normalizeCompletedAt(completed_at);
    }
    return payload;
};
const applyTaskTypeTopic = async (data = {}) => {
    const type = typeof data.task_type === 'string' ? data.task_type.trim() : '';
    if (!type) {
        return;
    }
    const topicId = await (0, taskTypeSettings_1.resolveTaskTypeTopicId)(type);
    if (typeof topicId === 'number') {
        data.telegram_topic_id = topicId;
    }
};
async function applyRouteInfo(data = {}) {
    if (data.startCoordinates && data.finishCoordinates) {
        data.google_route_url = (0, shared_1.generateRouteLink)(data.startCoordinates, data.finishCoordinates);
        try {
            const distanceKm = await (0, osrm_1.getOsrmDistance)({
                start: data.startCoordinates,
                finish: data.finishCoordinates,
            });
            data.route_distance_km = distanceKm;
        }
        catch {
            data.route_distance_km = null;
        }
    }
}
const create = async (data = {}, userId) => {
    if (data.due_date && !data.remind_at)
        data.remind_at = data.due_date;
    await applyRouteInfo(data);
    await (0, taskLinks_1.ensureTaskLinksShort)(data);
    await applyTaskTypeTopic(data);
    const payload = prepareTaskPayload(data);
    return q.createTask(payload, userId);
};
exports.create = create;
const get = (filters, page, limit) => q.getTasks(filters, page, limit);
exports.get = get;
const getById = (id) => q.getTask(id);
exports.getById = getById;
const update = async (id, data = {}, userId = 0) => {
    await applyRouteInfo(data);
    await (0, taskLinks_1.ensureTaskLinksShort)(data);
    if (Object.prototype.hasOwnProperty.call(data, 'task_type')) {
        await applyTaskTypeTopic(data);
    }
    const payload = prepareTaskPayload(data);
    return q.updateTask(id, payload, userId);
};
exports.update = update;
const addTime = (id, minutes, userId = 0) => q.addTime(id, minutes, userId);
exports.addTime = addTime;
const bulk = async (ids, data = {}) => {
    const draft = { ...(data ?? {}) };
    if (Object.prototype.hasOwnProperty.call(draft, 'status')) {
        const status = draft.status;
        const isCompleted = status === 'Выполнена' || status === 'Отменена';
        if (isCompleted) {
            if (!Object.prototype.hasOwnProperty.call(draft, 'completed_at')) {
                draft.completed_at = new Date();
            }
            else if (draft.completed_at === undefined) {
                draft.completed_at = new Date();
            }
        }
        else {
            draft.completed_at = null;
        }
    }
    await (0, taskLinks_1.ensureTaskLinksShort)(draft);
    const payload = prepareTaskPayload(draft);
    return q.bulkUpdate(ids, payload);
};
exports.bulk = bulk;
const summary = (filters) => q.summary(filters);
exports.summary = summary;
const remove = (id) => q.deleteTask(id);
exports.remove = remove;
const mentioned = (userId) => q.listMentionedTasks(userId);
exports.mentioned = mentioned;
