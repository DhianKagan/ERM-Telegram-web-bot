"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Сервис задач через репозиторий.
// Основные модули: db/queries, services/route, shared
const route_1 = require("../services/route");
const logisticsEvents_1 = require("../services/logisticsEvents");
const shared_1 = require("shared");
const rules_1 = require("../intake/rules");
const taskQueue_1 = require("../queues/taskQueue");
const wgLogEngine_1 = require("../services/wgLogEngine");
const attachments_1 = require("../utils/attachments");
const taskTypeSettings_1 = require("../services/taskTypeSettings");
const taskLinks_1 = require("../services/taskLinks");
const taskPoints_1 = require("../utils/taskPoints");
const toNumeric = (value) => {
    if (value === null || value === undefined)
        return undefined;
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return undefined;
        }
        const compact = trimmed.replace(/\s+/g, '').replace(/[\u2018\u2019']/g, '');
        if (!compact) {
            return undefined;
        }
        const hasComma = compact.includes(',');
        const hasDot = compact.includes('.');
        let normalized = compact;
        if (hasComma && hasDot) {
            normalized = compact.replace(/\./g, '').replace(/,/g, '.');
        }
        else if (hasComma) {
            normalized = compact.replace(/,/g, '.');
        }
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
};
const roundValue = (value, digits = 3) => Number(Number.isFinite(value) ? value.toFixed(digits) : Number.NaN);
const hasPoint = (coords) => typeof (coords === null || coords === void 0 ? void 0 : coords.lat) === 'number' &&
    Number.isFinite(coords.lat) &&
    typeof (coords === null || coords === void 0 ? void 0 : coords.lng) === 'number' &&
    Number.isFinite(coords.lng);
const setMetric = (target, key, value) => {
    const keyName = key;
    const hasOriginalValue = Object.prototype.hasOwnProperty.call(target, keyName);
    const rawValue = hasOriginalValue ? target[keyName] : undefined;
    if (value === undefined || Number.isNaN(value)) {
        if (hasOriginalValue) {
            if (rawValue === null) {
                target[keyName] = null;
                return;
            }
            if (typeof rawValue === 'string' && rawValue.trim() === '') {
                target[keyName] = null;
                return;
            }
            delete target[keyName];
            return;
        }
        delete target[keyName];
        return;
    }
    target[keyName] = value;
};
const normalizeTaskId = (value) => {
    if (!value)
        return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : null;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? String(Math.trunc(value)) : null;
    }
    if (typeof value === 'object' &&
        'toString' in value) {
        const str = value.toString();
        return typeof str === 'string' && str ? str : null;
    }
    return null;
};
class TasksService {
    constructor(repo) {
        var _a;
        this.repo = repo;
        if (!this.repo.createTask && ((_a = repo.Task) === null || _a === void 0 ? void 0 : _a.create)) {
            this.repo.createTask = repo.Task.create.bind(repo.Task);
        }
        if (!this.repo.createTask) {
            this.repo.createTask = async (d) => ({
                _id: '1',
                ...d,
            });
        }
    }
    async logAttachmentSync(action, task, shouldLog) {
        var _a;
        if (!task || !shouldLog)
            return;
        const ids = (0, attachments_1.extractAttachmentIds)(task.attachments || []);
        const message = action === 'create'
            ? `Вложения привязаны к задаче ${String(task._id)}`
            : `Вложения обновлены у задачи ${String(task._id)}`;
        try {
            await (0, wgLogEngine_1.writeLog)(message, 'info', {
                taskId: String(task._id),
                fileIds: ids.map((id) => id.toHexString()),
                attachments: Array.isArray(task.attachments)
                    ? task.attachments.length
                    : 0,
                action,
            });
        }
        catch (error) {
            await (0, wgLogEngine_1.writeLog)(`Ошибка логирования вложений задачи ${String((_a = task === null || task === void 0 ? void 0 : task._id) !== null && _a !== void 0 ? _a : 'unknown')}`, 'error', { error: error.message, action }).catch(() => undefined);
        }
    }
    async create(data = {}, userId) {
        const payload = data !== null && data !== void 0 ? data : {};
        (0, rules_1.applyIntakeRules)(payload);
        (0, taskPoints_1.syncTaskPoints)(payload);
        if (payload.due_date && !payload.remind_at)
            payload.remind_at = payload.due_date;
        this.applyCargoMetrics(payload);
        await this.applyGeocoding(payload);
        (0, taskPoints_1.syncTaskPoints)(payload);
        await this.applyRouteInfo(payload);
        await (0, taskLinks_1.ensureTaskLinksShort)(payload);
        await this.applyTaskTypeTopic(payload);
        const normalizedUserId = typeof userId === 'number' && Number.isFinite(userId)
            ? userId
            : undefined;
        const attachmentsList = Array.isArray(payload.attachments)
            ? payload.attachments
            : [];
        if (normalizedUserId === undefined && attachmentsList.length > 0) {
            const fileIds = (0, attachments_1.extractAttachmentIds)(payload.attachments || []);
            try {
                await (0, wgLogEngine_1.writeLog)('Создание задачи с вложениями без идентификатора пользователя, активирован fallback', 'warn', {
                    attachments: attachmentsList.length,
                    fileIds: fileIds.map((id) => id.toHexString()),
                    fallback: true,
                });
            }
            catch {
                /* игнорируем сбой логирования fallback */
            }
        }
        try {
            const task = await this.repo.createTask(payload, normalizedUserId);
            await (0, route_1.clearRouteCache)();
            await this.logAttachmentSync('create', task, Array.isArray(task.attachments) && task.attachments.length > 0);
            const taskId = normalizeTaskId(task === null || task === void 0 ? void 0 : task._id);
            if (taskId) {
                (0, logisticsEvents_1.notifyTasksChanged)('created', [taskId]);
            }
            return task;
        }
        catch (error) {
            await (0, wgLogEngine_1.writeLog)('Ошибка создания задачи с вложениями', 'error', {
                error: error.message,
            }).catch(() => undefined);
            throw error;
        }
    }
    get(filters, page, limit) {
        return this.repo.getTasks(filters, page, limit);
    }
    getById(id) {
        return this.repo.getTask(id);
    }
    async update(id, data = {}, userId) {
        var _a;
        const payload = data !== null && data !== void 0 ? data : {};
        if (Object.prototype.hasOwnProperty.call(payload, 'due_date')) {
            payload.deadline_reminder_sent_at =
                undefined;
        }
        (0, taskPoints_1.syncTaskPoints)(payload);
        this.applyCargoMetrics(payload);
        await this.applyGeocoding(payload);
        (0, taskPoints_1.syncTaskPoints)(payload);
        await this.applyRouteInfo(payload);
        await (0, taskLinks_1.ensureTaskLinksShort)(payload);
        await this.applyTaskTypeTopic(payload);
        try {
            const task = await this.repo.updateTask(id, payload, userId);
            await (0, route_1.clearRouteCache)();
            await this.logAttachmentSync('update', task, Object.prototype.hasOwnProperty.call(payload, 'attachments'));
            const taskId = (_a = normalizeTaskId(task === null || task === void 0 ? void 0 : task._id)) !== null && _a !== void 0 ? _a : normalizeTaskId(id);
            if (taskId) {
                (0, logisticsEvents_1.notifyTasksChanged)('updated', [taskId]);
            }
            return task;
        }
        catch (error) {
            await (0, wgLogEngine_1.writeLog)('Ошибка обновления вложений задачи', 'error', {
                taskId: id,
                error: error.message,
            }).catch(() => undefined);
            throw error;
        }
    }
    applyCargoMetrics(data = {}) {
        const target = data;
        const length = toNumeric(data.cargo_length_m);
        const width = toNumeric(data.cargo_width_m);
        const height = toNumeric(data.cargo_height_m);
        const weight = toNumeric(data.cargo_weight_kg);
        const volume = toNumeric(data.cargo_volume_m3);
        const paymentAmount = toNumeric(data.payment_amount);
        setMetric(target, 'cargo_length_m', length !== undefined ? roundValue(length) : undefined);
        setMetric(target, 'cargo_width_m', width !== undefined ? roundValue(width) : undefined);
        setMetric(target, 'cargo_height_m', height !== undefined ? roundValue(height) : undefined);
        setMetric(target, 'cargo_weight_kg', weight !== undefined ? roundValue(weight, 2) : undefined);
        setMetric(target, 'payment_amount', paymentAmount !== undefined ? roundValue(paymentAmount, 2) : undefined);
        if (length !== undefined && width !== undefined && height !== undefined) {
            setMetric(target, 'cargo_volume_m3', roundValue(length * width * height));
        }
        else {
            setMetric(target, 'cargo_volume_m3', volume !== undefined ? roundValue(volume) : undefined);
        }
    }
    async applyGeocoding(data = {}) {
        var _a, _b, _c;
        const normalize = (value) => {
            if (typeof value !== 'string') {
                return '';
            }
            const trimmed = value.trim();
            return trimmed;
        };
        const details = ((_a = data.logistics_details) !== null && _a !== void 0 ? _a : {});
        const startLocation = normalize((_b = details.start_location) !== null && _b !== void 0 ? _b : data.start_location);
        const endLocation = normalize((_c = details.end_location) !== null && _c !== void 0 ? _c : data.end_location);
        const shouldGeocodeStart = Boolean(startLocation) && !hasPoint(data.startCoordinates);
        const shouldGeocodeFinish = Boolean(endLocation) && !hasPoint(data.finishCoordinates);
        if (!shouldGeocodeStart && !shouldGeocodeFinish) {
            return;
        }
        const startPromise = shouldGeocodeStart
            ? (0, taskQueue_1.requestGeocodingJob)(startLocation)
            : Promise.resolve(null);
        const finishPromise = shouldGeocodeFinish
            ? (0, taskQueue_1.requestGeocodingJob)(endLocation)
            : Promise.resolve(null);
        const [startCoords, finishCoords] = await Promise.all([
            startPromise,
            finishPromise,
        ]);
        if (startCoords) {
            data.startCoordinates = startCoords;
        }
        if (finishCoords) {
            data.finishCoordinates = finishCoords;
        }
    }
    async applyRouteInfo(data = {}) {
        const target = data;
        const hasStartUpdate = Object.prototype.hasOwnProperty.call(target, 'startCoordinates');
        const hasFinishUpdate = Object.prototype.hasOwnProperty.call(target, 'finishCoordinates');
        const clearRouteDistance = () => {
            target.route_distance_km = null;
        };
        if (data.startCoordinates && data.finishCoordinates) {
            data.google_route_url = (0, shared_1.generateRouteLink)(data.startCoordinates, data.finishCoordinates);
            try {
                const { distanceKm } = await (0, taskQueue_1.requestRouteDistanceJob)({
                    start: data.startCoordinates,
                    finish: data.finishCoordinates,
                });
                data.route_distance_km = distanceKm !== null && distanceKm !== void 0 ? distanceKm : null;
            }
            catch {
                clearRouteDistance();
            }
            return;
        }
        if (hasStartUpdate || hasFinishUpdate) {
            clearRouteDistance();
        }
    }
    async applyTaskTypeTopic(data = {}) {
        const typeValue = data.task_type;
        if (typeof typeValue !== 'string') {
            return;
        }
        const type = typeValue.trim();
        if (!type) {
            return;
        }
        try {
            const topicId = await (0, taskTypeSettings_1.resolveTaskTypeTopicId)(type);
            if (typeof topicId === 'number') {
                data.telegram_topic_id = topicId;
            }
        }
        catch (error) {
            console.error('Не удалось определить тему Telegram для типа задачи', error);
        }
    }
    async addTime(id, minutes) {
        const task = await this.repo.addTime(id, minutes);
        await (0, route_1.clearRouteCache)();
        return task;
    }
    async bulk(ids, data) {
        const payload = { ...(data !== null && data !== void 0 ? data : {}) };
        if (Object.prototype.hasOwnProperty.call(payload, 'kind')) {
            delete payload.kind;
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
            const status = payload.status;
            const isCompleted = status === 'Выполнена' || status === 'Отменена';
            if (isCompleted) {
                if (!Object.prototype.hasOwnProperty.call(payload, 'completed_at')) {
                    payload.completed_at = new Date();
                }
                else if (payload.completed_at === undefined) {
                    payload.completed_at = new Date();
                }
            }
            else {
                payload.completed_at = null;
            }
        }
        (0, taskPoints_1.syncTaskPoints)(payload);
        await (0, taskLinks_1.ensureTaskLinksShort)(payload);
        await this.applyTaskTypeTopic(payload);
        await this.repo.bulkUpdate(ids, payload);
        await (0, route_1.clearRouteCache)();
    }
    summary(filters) {
        return this.repo.summary(filters);
    }
    chart(filters) {
        return this.repo.chart(filters);
    }
    async remove(id, actorId) {
        var _a;
        const task = await this.repo.deleteTask(id, actorId);
        await (0, route_1.clearRouteCache)();
        const taskId = (_a = normalizeTaskId(task === null || task === void 0 ? void 0 : task._id)) !== null && _a !== void 0 ? _a : normalizeTaskId(id);
        if (task && taskId) {
            (0, logisticsEvents_1.notifyTasksChanged)('deleted', [taskId]);
        }
        return task;
    }
    mentioned(userId) {
        return this.repo.listMentionedTasks(userId);
    }
}
exports.default = TasksService;
