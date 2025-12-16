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
exports.findTaskIdByPublicIdentifier = findTaskIdByPublicIdentifier;
exports.syncTaskAttachments = syncTaskAttachments;
exports.accessByRole = accessByRole;
exports.createTask = createTask;
exports.getTask = getTask;
exports.listMentionedTasks = listMentionedTasks;
exports.updateTask = updateTask;
exports.updateTaskStatus = updateTaskStatus;
exports.getTasks = getTasks;
exports.listRoutes = listRoutes;
exports.searchTasks = searchTasks;
exports.addTime = addTime;
exports.bulkUpdate = bulkUpdate;
exports.deleteTask = deleteTask;
exports.listArchivedTasks = listArchivedTasks;
exports.purgeArchivedTasks = purgeArchivedTasks;
exports.tasksChart = tasksChart;
exports.summary = summary;
exports.generateUserCredentials = generateUserCredentials;
exports.createUser = createUser;
exports.getUser = getUser;
exports.listUsers = listUsers;
exports.removeUser = removeUser;
exports.getUsersMap = getUsersMap;
exports.updateUser = updateUser;
exports.listRoles = listRoles;
exports.getRole = getRole;
exports.updateRole = updateRole;
exports.createTaskTemplate = createTaskTemplate;
exports.getTaskTemplate = getTaskTemplate;
exports.listTaskTemplates = listTaskTemplates;
exports.deleteTaskTemplate = deleteTaskTemplate;
// Централизованные функции работы с MongoDB для всего проекта
// Основные модули: mongoose модели, wgLogEngine, roleCache
const model_1 = require("./model");
const fleet_1 = require("./models/fleet");
const logEngine = __importStar(require("../services/wgLogEngine"));
const roleCache_1 = require("./roleCache");
const mongoose_1 = require("mongoose");
const accessMask_1 = require("../utils/accessMask");
const attachments_1 = require("../utils/attachments");
const dataStorage_1 = require("../services/dataStorage");
const fileUrls_1 = require("../utils/fileUrls");
const assigneeIds_1 = require("../utils/assigneeIds");
function escapeRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// Отфильтровывает ключи с операторами, чтобы предотвратить NoSQL-инъекции
function sanitizeUpdate(data) {
    const res = {};
    if (data && typeof data === 'object') {
        Object.entries(data).forEach(([k, v]) => {
            if (typeof k === 'string' && !k.startsWith('$') && !k.includes('.')) {
                res[k] = v;
            }
        });
    }
    return res;
}
function normalizeAttachmentsField(target) {
    if (!target || typeof target !== 'object')
        return;
    if (!Object.prototype.hasOwnProperty.call(target, 'attachments'))
        return;
    const normalized = (0, attachments_1.coerceAttachments)(target.attachments);
    if (normalized === undefined) {
        delete target.attachments;
        return;
    }
    target.attachments = normalized;
}
const TRANSPORT_REQUIRED_TYPES = new Set(['Легковой', 'Грузовой']);
const isTransportRequired = (value) => {
    if (typeof value !== 'string')
        return false;
    return TRANSPORT_REQUIRED_TYPES.has(value.trim());
};
const isBsonSizeError = (error) => {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const payload = error;
    if (payload && typeof payload.code === 'number' && payload.code === 10334) {
        return true;
    }
    if (typeof (payload === null || payload === void 0 ? void 0 : payload.message) === 'string') {
        const text = payload.message;
        return (text.includes('BSONObj size') ||
            text.toLowerCase().includes('exceeds maximum document size') ||
            text.toLowerCase().includes('exceeds max document size'));
    }
    return false;
};
const HISTORY_ARCHIVE_REASON = 'bson-document-overflow';
const persistHistoryEntryToArchive = async (taskId, entry) => {
    const normalizedChangedBy = typeof entry.changed_by === 'number' && Number.isFinite(entry.changed_by)
        ? entry.changed_by
        : 0;
    try {
        await model_1.TaskHistoryArchive.create({
            taskId,
            entries: [entry],
            createdBy: normalizedChangedBy,
            reason: HISTORY_ARCHIVE_REASON,
        });
    }
    catch (error) {
        await logEngine
            .writeLog('Не удалось сохранить историю задачи во внешний архив', 'error', {
            taskId: taskId.toHexString(),
            reason: HISTORY_ARCHIVE_REASON,
            error: error instanceof Error ? error.message : String(error),
        })
            .catch(() => undefined);
        throw error;
    }
    try {
        const updateQuery = model_1.Task.updateOne({ _id: taskId }, {
            $inc: { history_overflow_count: 1 },
        });
        if (typeof updateQuery.exec === 'function') {
            await updateQuery.exec();
        }
        else {
            await updateQuery;
        }
    }
    catch (error) {
        await logEngine
            .writeLog('Не удалось отметить внешний архив истории задачи', 'error', {
            taskId: taskId.toHexString(),
            reason: HISTORY_ARCHIVE_REASON,
            error: error instanceof Error ? error.message : String(error),
        })
            .catch(() => undefined);
        throw error;
    }
    await logEngine
        .writeLog('История задачи сохранена во внешний архив из-за превышения размера документа', 'warn', {
        taskId: taskId.toHexString(),
        reason: HISTORY_ARCHIVE_REASON,
    })
        .catch(() => undefined);
};
const hydrateTaskHistory = async (task) => {
    if (!task) {
        return task;
    }
    const rawId = task._id;
    const overflowValue = task.history_overflow_count;
    const hasOverflowFlag = typeof overflowValue === 'number' &&
        Number.isFinite(overflowValue) &&
        overflowValue > 0;
    if (!hasOverflowFlag &&
        (!Array.isArray(task.history) || task.history.length === 0)) {
        return task;
    }
    const normalizedId = rawId instanceof mongoose_1.Types.ObjectId
        ? rawId
        : typeof rawId === 'string' && mongoose_1.Types.ObjectId.isValid(rawId)
            ? new mongoose_1.Types.ObjectId(rawId)
            : null;
    if (!normalizedId) {
        return task;
    }
    const archiveDocs = await model_1.TaskHistoryArchive.find({ taskId: normalizedId })
        .sort({ createdAt: 1, _id: 1 })
        .lean()
        .exec();
    if (!archiveDocs.length) {
        return task;
    }
    const archivedEntries = archiveDocs.flatMap((doc) => Array.isArray(doc.entries) ? doc.entries : []);
    if (!archivedEntries.length) {
        return task;
    }
    const currentHistory = Array.isArray(task.history) ? [...task.history] : [];
    const combined = [...archivedEntries, ...currentHistory];
    combined.sort((a, b) => {
        const left = a.changed_at instanceof Date
            ? a.changed_at.getTime()
            : new Date(a.changed_at).getTime();
        const right = b.changed_at instanceof Date
            ? b.changed_at.getTime()
            : new Date(b.changed_at).getTime();
        return left - right;
    });
    task.history = combined;
    return task;
};
const toObjectId = (value) => {
    if (value instanceof mongoose_1.Types.ObjectId)
        return value;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed && mongoose_1.Types.ObjectId.isValid(trimmed)) {
            return new mongoose_1.Types.ObjectId(trimmed);
        }
    }
    return null;
};
async function normalizeTransportFields(payload, previous) {
    var _a, _b, _c;
    const typeCandidate = Object.prototype.hasOwnProperty.call(payload, 'transport_type')
        ? payload.transport_type
        : previous === null || previous === void 0 ? void 0 : previous.transport_type;
    const requiresTransport = isTransportRequired(typeCandidate);
    if (!requiresTransport) {
        const transportFields = [
            'transport_driver_id',
            'transport_driver_name',
            'transport_vehicle_id',
            'transport_vehicle_name',
            'transport_vehicle_registration',
        ];
        transportFields.forEach((field) => {
            const hasOwnValue = Object.prototype.hasOwnProperty.call(payload, field);
            const previousValue = previous != null
                ? previous[field]
                : undefined;
            if (hasOwnValue) {
                payload[field] = null;
            }
            else if (previousValue !== null && previousValue !== undefined) {
                payload[field] = null;
            }
        });
        return;
    }
    const driverFieldProvided = Object.prototype.hasOwnProperty.call(payload, 'transport_driver_id');
    if (driverFieldProvided) {
        const driverRaw = payload.transport_driver_id;
        const driverValue = typeof driverRaw === 'number'
            ? driverRaw
            : typeof driverRaw === 'string'
                ? Number(driverRaw.trim())
                : Number.NaN;
        payload.transport_driver_id = Number.isFinite(driverValue)
            ? driverValue
            : null;
    }
    else if (previous) {
        payload.transport_driver_id = (_a = previous.transport_driver_id) !== null && _a !== void 0 ? _a : null;
    }
    const driverNameProvided = Object.prototype.hasOwnProperty.call(payload, 'transport_driver_name');
    if (driverNameProvided) {
        const rawName = payload.transport_driver_name;
        if (typeof rawName === 'string') {
            const trimmed = rawName.trim();
            payload.transport_driver_name = trimmed.length > 0 ? trimmed : null;
        }
        else {
            payload.transport_driver_name = null;
        }
    }
    else if (payload.transport_driver_id === null) {
        payload.transport_driver_name = null;
    }
    else if (previous &&
        typeof previous.transport_driver_id === 'number' &&
        Number.isFinite(previous.transport_driver_id) &&
        previous.transport_driver_id === payload.transport_driver_id) {
        const prevName = typeof previous.transport_driver_name === 'string'
            ? previous.transport_driver_name.trim()
            : null;
        payload.transport_driver_name =
            prevName && prevName.length > 0 ? prevName : null;
    }
    else {
        payload.transport_driver_name = null;
    }
    const resolvedDriverId = driverFieldProvided
        ? typeof payload.transport_driver_id === 'number' &&
            Number.isFinite(payload.transport_driver_id)
            ? payload.transport_driver_id
            : null
        : typeof (previous === null || previous === void 0 ? void 0 : previous.transport_driver_id) === 'number' &&
            Number.isFinite(previous.transport_driver_id)
            ? previous.transport_driver_id
            : null;
    const currentDriverName = typeof payload.transport_driver_name === 'string' &&
        payload.transport_driver_name.trim().length > 0
        ? payload.transport_driver_name.trim()
        : null;
    if (resolvedDriverId !== null && !currentDriverName) {
        const driver = await model_1.User.findOne({ telegram_id: { $eq: resolvedDriverId } }, { name: 1, username: 1 })
            .lean()
            .exec();
        const resolvedName = driver
            ? typeof driver.name === 'string' && driver.name.trim().length > 0
                ? driver.name.trim()
                : typeof driver.username === 'string' &&
                    driver.username.trim().length > 0
                    ? driver.username.trim()
                    : null
            : null;
        if (resolvedName) {
            payload.transport_driver_name = resolvedName;
        }
        else if (driverNameProvided) {
            payload.transport_driver_name = null;
        }
    }
    let vehicleId = null;
    const vehicleFieldProvided = Object.prototype.hasOwnProperty.call(payload, 'transport_vehicle_id');
    if (vehicleFieldProvided) {
        vehicleId = toObjectId(payload.transport_vehicle_id);
        if (!vehicleId) {
            payload.transport_vehicle_id = null;
            payload.transport_vehicle_name = null;
            payload.transport_vehicle_registration = null;
        }
    }
    else if (previous === null || previous === void 0 ? void 0 : previous.transport_vehicle_id) {
        vehicleId = previous.transport_vehicle_id;
        payload.transport_vehicle_id = previous.transport_vehicle_id;
        payload.transport_vehicle_name = (_b = previous.transport_vehicle_name) !== null && _b !== void 0 ? _b : null;
        payload.transport_vehicle_registration =
            (_c = previous.transport_vehicle_registration) !== null && _c !== void 0 ? _c : null;
    }
    if (vehicleId) {
        const vehicle = await fleet_1.FleetVehicle.findById(vehicleId).lean();
        if (!vehicle) {
            payload.transport_vehicle_id = null;
            payload.transport_vehicle_name = null;
            payload.transport_vehicle_registration = null;
            vehicleId = null;
        }
        else {
            payload.transport_vehicle_id = vehicle._id;
            payload.transport_vehicle_name = vehicle.name;
            payload.transport_vehicle_registration = vehicle.registrationNumber;
        }
    }
}
const toTaskIdString = (current, previous) => {
    var _a;
    const idCandidate = (_a = current === null || current === void 0 ? void 0 : current._id) !== null && _a !== void 0 ? _a : previous === null || previous === void 0 ? void 0 : previous._id;
    return idCandidate ? String(idCandidate) : null;
};
async function attachVehicle(vehicleId, taskId, taskTitle) {
    const vehicle = await fleet_1.FleetVehicle.findById(vehicleId);
    if (!vehicle)
        return;
    const tasks = Array.isArray(vehicle.currentTasks)
        ? [...vehicle.currentTasks]
        : [];
    if (!tasks.includes(taskId)) {
        tasks.push(taskId);
        vehicle.currentTasks = tasks;
    }
    const history = Array.isArray(vehicle.transportHistory)
        ? [...vehicle.transportHistory]
        : [];
    const entry = history.find((item) => item.taskId === taskId);
    const now = new Date();
    if (entry) {
        entry.assignedAt = now;
        entry.removedAt = undefined;
        if (taskTitle)
            entry.taskTitle = taskTitle;
    }
    else {
        history.push({
            taskId,
            taskTitle,
            assignedAt: now,
        });
    }
    vehicle.transportHistory = history;
    await vehicle.save();
}
async function detachVehicle(vehicleId, taskId) {
    const vehicle = await fleet_1.FleetVehicle.findById(vehicleId);
    if (!vehicle)
        return;
    if (Array.isArray(vehicle.currentTasks)) {
        vehicle.currentTasks = vehicle.currentTasks.filter((item) => item !== taskId);
    }
    if (Array.isArray(vehicle.transportHistory)) {
        const entry = vehicle.transportHistory.find((item) => item.taskId === taskId && !item.removedAt);
        if (entry) {
            entry.removedAt = new Date();
        }
    }
    await vehicle.save();
}
async function syncVehicleAssignments(previous, current) {
    const taskId = toTaskIdString(current, previous);
    if (!taskId)
        return;
    const prevRequires = previous
        ? isTransportRequired(previous.transport_type)
        : false;
    const nextRequires = current
        ? isTransportRequired(current.transport_type)
        : false;
    const prevVehicleId = prevRequires && (previous === null || previous === void 0 ? void 0 : previous.transport_vehicle_id)
        ? String(previous.transport_vehicle_id)
        : null;
    const nextVehicleId = nextRequires && (current === null || current === void 0 ? void 0 : current.transport_vehicle_id)
        ? String(current.transport_vehicle_id)
        : null;
    if (prevVehicleId && prevVehicleId !== nextVehicleId) {
        await detachVehicle(prevVehicleId, taskId);
    }
    if (nextVehicleId) {
        const title = typeof (current === null || current === void 0 ? void 0 : current.title) === 'string'
            ? current.title
            : typeof (previous === null || previous === void 0 ? void 0 : previous.title) === 'string'
                ? previous.title
                : undefined;
        await attachVehicle(nextVehicleId, taskId, title);
    }
    else if (prevVehicleId && !nextVehicleId) {
        await detachVehicle(prevVehicleId, taskId);
    }
}
async function safeSyncVehicleAssignments(previous, current) {
    var _a;
    try {
        await syncVehicleAssignments(previous, current);
    }
    catch (error) {
        const id = (_a = toTaskIdString(current, previous)) !== null && _a !== void 0 ? _a : 'unknown';
        const message = error instanceof Error ? error.message : String(error);
        await logEngine
            .writeLog('Не удалось синхронизировать транспорт задачи', 'error', {
            taskId: id,
            error: message,
        })
            .catch(() => undefined);
    }
}
const ensureDate = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return undefined;
};
const pickNumber = (...values) => {
    for (const candidate of values) {
        if (typeof candidate === 'number' && Number.isFinite(candidate)) {
            return candidate;
        }
    }
    return undefined;
};
const pickString = (...values) => {
    for (const candidate of values) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate;
        }
    }
    return undefined;
};
const buildAttachmentKey = (attachment) => {
    if (!attachment || typeof attachment.url !== 'string') {
        return null;
    }
    const trimmed = attachment.url.trim();
    if (!trimmed) {
        return null;
    }
    const [pathPart] = trimmed.split('?');
    const segments = pathPart.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && mongoose_1.Types.ObjectId.isValid(last)) {
        return `file:${last}`;
    }
    return `url:${trimmed}`;
};
const resolveAttachmentFileId = (attachment) => {
    const key = buildAttachmentKey(attachment);
    if (key && key.startsWith('file:')) {
        return key.slice(5);
    }
    return null;
};
const mergeAttachmentSources = (current, sources) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
    const uploadedAt = ensureDate(current.uploadedAt) ||
        ensureDate((_a = sources.previous) === null || _a === void 0 ? void 0 : _a.uploadedAt) ||
        ensureDate((_b = sources.file) === null || _b === void 0 ? void 0 : _b.uploadedAt) ||
        new Date();
    const thumbnailFromFile = (() => {
        var _a;
        if (!((_a = sources.file) === null || _a === void 0 ? void 0 : _a.thumbnailPath) || !sources.file.thumbnailPath.trim()) {
            return undefined;
        }
        return (0, fileUrls_1.buildThumbnailUrl)(sources.file._id);
    })();
    return {
        ...sources.previous,
        ...current,
        name: (_e = pickString(current.name, (_c = sources.previous) === null || _c === void 0 ? void 0 : _c.name, (_d = sources.file) === null || _d === void 0 ? void 0 : _d.name)) !== null && _e !== void 0 ? _e : current.name,
        url: sources.file ? (0, fileUrls_1.buildFileUrl)(sources.file._id) : current.url,
        thumbnailUrl: (_g = pickString(current.thumbnailUrl, (_f = sources.previous) === null || _f === void 0 ? void 0 : _f.thumbnailUrl)) !== null && _g !== void 0 ? _g : thumbnailFromFile,
        uploadedBy: (_k = pickNumber(current.uploadedBy, (_h = sources.previous) === null || _h === void 0 ? void 0 : _h.uploadedBy, (_j = sources.file) === null || _j === void 0 ? void 0 : _j.userId)) !== null && _k !== void 0 ? _k : current.uploadedBy,
        uploadedAt,
        type: (_p = (_o = pickString(current.type, (_l = sources.previous) === null || _l === void 0 ? void 0 : _l.type, (_m = sources.file) === null || _m === void 0 ? void 0 : _m.type)) !== null && _o !== void 0 ? _o : current.type) !== null && _p !== void 0 ? _p : 'application/octet-stream',
        size: (_s = pickNumber(current.size, (_q = sources.previous) === null || _q === void 0 ? void 0 : _q.size, (_r = sources.file) === null || _r === void 0 ? void 0 : _r.size)) !== null && _s !== void 0 ? _s : current.size,
    };
};
async function enrichAttachmentsFromContent(data, previous) {
    let attachmentsRaw = data.attachments;
    const previousAttachments = Array.isArray(previous === null || previous === void 0 ? void 0 : previous.attachments)
        ? previous === null || previous === void 0 ? void 0 : previous.attachments
        : undefined;
    if (attachmentsRaw === undefined) {
        const commentHtml = typeof data.comment === 'string' ? data.comment : undefined;
        const derived = (0, attachments_1.buildAttachmentsFromCommentHtml)(commentHtml !== null && commentHtml !== void 0 ? commentHtml : '', {
            existing: previousAttachments,
        });
        if (derived.length === 0) {
            return undefined;
        }
        attachmentsRaw = derived;
    }
    if (!Array.isArray(attachmentsRaw) || attachmentsRaw.length === 0) {
        return [];
    }
    const attachments = attachmentsRaw.map((item) => ({
        ...item,
    }));
    const previousByKey = new Map();
    if (previous && Array.isArray(previous.attachments)) {
        previous.attachments.forEach((item) => {
            const key = buildAttachmentKey(item);
            if (key) {
                previousByKey.set(key, item);
            }
        });
    }
    const fileIds = new Set();
    const attachmentFileMap = new Map();
    attachments.forEach((attachment, index) => {
        const fileId = resolveAttachmentFileId(attachment);
        if (fileId) {
            fileIds.add(fileId);
            attachmentFileMap.set(index, fileId);
        }
    });
    const filesMap = new Map();
    const fileModel = model_1.File;
    if (fileIds.size > 0 && fileModel && typeof fileModel.find === 'function') {
        const objectIds = Array.from(fileIds).map((id) => new mongoose_1.Types.ObjectId(id));
        const docs = await fileModel.find({ _id: { $in: objectIds } }).lean();
        docs.forEach((doc) => {
            filesMap.set(String(doc._id), doc);
        });
    }
    attachments.forEach((attachment, index) => {
        const key = buildAttachmentKey(attachment);
        const prevAttachment = key ? previousByKey.get(key) : undefined;
        const fileId = attachmentFileMap.get(index);
        const fileDoc = fileId ? filesMap.get(fileId) : undefined;
        attachments[index] = mergeAttachmentSources(attachment, {
            file: fileDoc,
            previous: prevAttachment,
        });
    });
    return attachments;
}
const REQUEST_TYPE_NAME = 'Заявка';
const detectTaskKind = (task) => {
    const rawKind = typeof task.kind === 'string' ? task.kind.trim().toLowerCase() : '';
    if (rawKind === 'request') {
        return 'request';
    }
    const typeLabel = typeof task.task_type === 'string' ? task.task_type.trim() : '';
    return typeLabel === REQUEST_TYPE_NAME ? 'request' : 'task';
};
function normalizeObjectId(value) {
    if (value instanceof mongoose_1.Types.ObjectId) {
        return value;
    }
    if (value &&
        typeof value === 'object' &&
        typeof value.toHexString === 'function') {
        const hex = value.toHexString();
        return mongoose_1.Types.ObjectId.isValid(hex) ? new mongoose_1.Types.ObjectId(hex) : null;
    }
    if (typeof value === 'string' && mongoose_1.Types.ObjectId.isValid(value)) {
        return new mongoose_1.Types.ObjectId(value);
    }
    return null;
}
async function findTaskIdByPublicIdentifier(identifier, userId) {
    const trimmed = identifier.trim();
    if (!trimmed) {
        return null;
    }
    const taskModel = model_1.Task;
    if (!taskModel || typeof taskModel.findOne !== 'function') {
        return null;
    }
    try {
        const fallbackTask = await taskModel
            .findOne({
            $or: [{ task_number: trimmed }, { request_id: trimmed }],
        })
            .select({ _id: 1 })
            .lean();
        return normalizeObjectId(fallbackTask === null || fallbackTask === void 0 ? void 0 : fallbackTask._id);
    }
    catch (lookupError) {
        await Promise.resolve(logEngine.writeLog(`Не удалось найти задачу по номеру ${trimmed} при обновлении вложений`, 'warn', { taskNumber: trimmed, userId, error: lookupError.message })).catch(() => undefined);
        return null;
    }
}
async function syncTaskAttachments(taskIdInput, attachments, userId) {
    if (attachments === undefined)
        return;
    let normalizedTaskId = typeof taskIdInput === 'string'
        ? mongoose_1.Types.ObjectId.isValid(taskIdInput)
            ? new mongoose_1.Types.ObjectId(taskIdInput)
            : null
        : taskIdInput;
    if (!normalizedTaskId && typeof taskIdInput === 'string') {
        normalizedTaskId = await findTaskIdByPublicIdentifier(taskIdInput, userId);
    }
    if (!normalizedTaskId) {
        await logEngine
            .writeLog(`Некорректный идентификатор задачи при обновлении вложений ${String(taskIdInput)}`, 'warn', { taskId: String(taskIdInput), userId })
            .catch(() => undefined);
        return;
    }
    const fileModel = model_1.File;
    if (!fileModel) {
        await logEngine
            .writeLog(`Модель файлов недоступна, пропускаем обновление вложений задачи ${String(normalizedTaskId)}`, 'warn', { taskId: normalizedTaskId.toHexString(), userId })
            .catch(() => undefined);
        return;
    }
    if (typeof fileModel.updateMany !== 'function') {
        await logEngine
            .writeLog(`Метод updateMany отсутствует у модели файлов, пропускаем обновление вложений задачи ${String(normalizedTaskId)}`, 'warn', { taskId: normalizedTaskId.toHexString(), userId })
            .catch(() => undefined);
        return;
    }
    const fileIds = (0, attachments_1.extractAttachmentIds)(attachments);
    const idsForLog = fileIds.map((id) => id.toHexString());
    const normalizedUserId = typeof userId === 'number' && Number.isFinite(userId) ? userId : undefined;
    let canManageForeignAttachments = false;
    const userModel = model_1.User;
    if (normalizedUserId !== undefined &&
        userModel &&
        typeof userModel.findOne === 'function') {
        try {
            const userRecord = await userModel
                .findOne({ telegram_id: normalizedUserId })
                .select({ access: 1 })
                .lean()
                .exec();
            const accessMask = userRecord && typeof userRecord.access === 'number'
                ? userRecord.access
                : 0;
            canManageForeignAttachments =
                (0, accessMask_1.hasAccess)(accessMask, accessMask_1.ACCESS_ADMIN) ||
                    (0, accessMask_1.hasAccess)(accessMask, accessMask_1.ACCESS_MANAGER);
        }
        catch (permissionError) {
            try {
                await logEngine.writeLog(`Не удалось проверить права пользователя при обновлении вложений задачи ${normalizedTaskId.toHexString()}`, 'warn', {
                    taskId: normalizedTaskId.toHexString(),
                    userId: normalizedUserId,
                    error: permissionError.message,
                });
            }
            catch {
                /* игнорируем сбой логирования */
            }
        }
    }
    try {
        if (fileIds.length === 0) {
            await fileModel.updateMany({ taskId: normalizedTaskId }, { $unset: { taskId: '', draftId: '' } });
            return;
        }
        const updateFilter = {
            _id: { $in: fileIds },
        };
        if (!canManageForeignAttachments) {
            if (normalizedUserId !== undefined) {
                updateFilter.$or = [
                    { userId: normalizedUserId },
                    { taskId: normalizedTaskId },
                ];
            }
            else {
                updateFilter.$or = [
                    { taskId: normalizedTaskId },
                    {
                        taskId: null,
                        $or: [{ userId: null }, { userId: { $exists: false } }],
                    },
                ];
            }
        }
        const updateResult = await fileModel.updateMany(updateFilter, {
            $set: { taskId: normalizedTaskId },
            $unset: { draftId: '' },
        });
        if (!canManageForeignAttachments) {
            const matched = updateResult && typeof updateResult === 'object'
                ? typeof updateResult.matchedCount ===
                    'number'
                    ? updateResult.matchedCount
                    : typeof updateResult
                        .modifiedCount === 'number'
                        ? updateResult.modifiedCount
                        : undefined
                : undefined;
            if (matched === 0 && fileIds.length > 0) {
                try {
                    await logEngine.writeLog(`Нет доступных вложений для привязки при обновлении задачи ${normalizedTaskId.toHexString()}`, 'warn', {
                        taskId: normalizedTaskId.toHexString(),
                        userId: normalizedUserId,
                        requestedFileIds: idsForLog,
                    });
                }
                catch {
                    /* игнорируем сбой логирования */
                }
            }
            else if (typeof matched === 'number' &&
                matched >= 0 &&
                matched < fileIds.length) {
                try {
                    await logEngine.writeLog(`Отфильтрованы недоступные вложения при обновлении задачи ${normalizedTaskId.toHexString()}`, 'warn', {
                        taskId: normalizedTaskId.toHexString(),
                        userId: normalizedUserId,
                        requestedFileIds: idsForLog,
                        обновлено: matched,
                    });
                }
                catch {
                    /* игнорируем сбой логирования */
                }
            }
        }
        await fileModel.updateMany({ taskId: normalizedTaskId, _id: { $nin: fileIds } }, { $unset: { taskId: '', draftId: '' } });
    }
    catch (error) {
        await logEngine.writeLog(`Ошибка обновления вложений задачи ${normalizedTaskId.toHexString()}`, 'error', {
            taskId: normalizedTaskId.toHexString(),
            fileIds: idsForLog,
            error: error.message,
        });
        throw error;
    }
}
// Возвращает уровень доступа по имени роли
function accessByRole(role) {
    switch (role) {
        case 'admin':
            return accessMask_1.ACCESS_ADMIN | accessMask_1.ACCESS_MANAGER;
        case 'manager':
            return accessMask_1.ACCESS_MANAGER;
        default:
            return accessMask_1.ACCESS_USER;
    }
}
async function createTask(data, userId) {
    const payload = data ? { ...data } : {};
    await normalizeTransportFields(payload, null);
    normalizeAttachmentsField(payload);
    const enrichedAttachments = await enrichAttachmentsFromContent(payload, null);
    if (enrichedAttachments !== undefined) {
        payload.attachments =
            enrichedAttachments;
    }
    const entry = {
        changed_at: new Date(),
        changed_by: payload.created_by || 0,
        changes: { from: {}, to: payload },
    };
    const task = await model_1.Task.create({ ...payload, history: [entry] });
    await syncTaskAttachments(task._id, task.attachments, userId);
    await safeSyncVehicleAssignments(null, task);
    return task;
}
async function getTask(id) {
    const normalizedId = typeof id === 'string' ? id.trim() : '';
    if (!normalizedId || !mongoose_1.Types.ObjectId.isValid(normalizedId)) {
        return null;
    }
    const task = await model_1.Task.findById(normalizedId);
    return hydrateTaskHistory(task);
}
async function listMentionedTasks(userId) {
    return model_1.Task.find({
        $or: [
            { assigned_user_id: userId },
            { controller_user_id: userId },
            { controllers: userId },
            { assignees: userId },
            { created_by: userId },
            { 'comments.author_id': userId },
            { transport_driver_id: userId },
        ],
    });
}
async function updateTask(id, fields, userId) {
    const data = sanitizeUpdate(fields);
    const prev = await model_1.Task.findById(id);
    if (!prev)
        return null;
    await normalizeTransportFields(data, prev);
    if (Object.prototype.hasOwnProperty.call(data, 'kind')) {
        delete data.kind;
    }
    normalizeAttachmentsField(data);
    const enrichedAttachments = await enrichAttachmentsFromContent(data, prev);
    if (enrichedAttachments !== undefined) {
        data.attachments =
            enrichedAttachments;
    }
    const kind = detectTaskKind(prev);
    const creatorId = Number(prev.created_by);
    const isCreator = Number.isFinite(creatorId) && creatorId === userId;
    const assignedUserId = typeof prev.assigned_user_id === 'number'
        ? prev.assigned_user_id
        : undefined;
    const assignees = Array.isArray(prev.assignees)
        ? prev.assignees
            .map((candidate) => Number(candidate))
            .filter((candidate) => Number.isFinite(candidate))
        : [];
    const isExecutor = (typeof assignedUserId === 'number' && assignedUserId === userId) ||
        assignees.includes(userId);
    const shouldAssertStatus = typeof prev.status === 'string' && prev.status === 'Новая';
    if (Object.prototype.hasOwnProperty.call(data, 'status')) {
        const nextStatus = data.status;
        if (nextStatus === 'Новая') {
            data.in_progress_at = null;
        }
        else if (nextStatus === 'Отменена') {
            if (kind === 'task' && !isCreator) {
                const err = new Error('Статус «Отменена» может установить только создатель задачи.');
                err.code = 'TASK_CANCEL_FORBIDDEN';
                throw err;
            }
            if (kind === 'request' && !isCreator && !isExecutor) {
                const err = new Error('Отменить заявку могут только исполнитель или создатель.');
                err.code =
                    'TASK_REQUEST_CANCEL_FORBIDDEN';
                throw err;
            }
        }
    }
    const from = {};
    const to = {};
    const shouldAutoAppendComment = Object.prototype.hasOwnProperty.call(data, 'comment') &&
        !Object.prototype.hasOwnProperty.call(data, 'comments');
    if (shouldAutoAppendComment) {
        const nextComment = typeof data.comment === 'string' ? data.comment.trim() : '';
        const previousComment = typeof prev.comment === 'string' ? prev.comment.trim() : '';
        if (nextComment && nextComment !== previousComment) {
            const commentEntry = {
                author_id: userId,
                text: nextComment,
                created_at: new Date(),
            };
            const existing = Array.isArray(prev.comments)
                ? prev.comments
                : [];
            data.comments = [...existing, commentEntry];
        }
    }
    Object.entries(data).forEach(([k, v]) => {
        const oldVal = prev[k];
        if (oldVal !== v) {
            from[k] = oldVal;
            to[k] = v;
        }
    });
    if (Object.keys(to).length === 0) {
        return prev;
    }
    const entry = {
        changed_at: new Date(),
        changed_by: userId,
        changes: { from, to },
    };
    const query = { _id: prev._id };
    if (shouldAssertStatus) {
        query.status = 'Новая';
    }
    const runUpdate = () => model_1.Task.findOneAndUpdate(query, {
        $set: data,
        $push: { history: entry },
    }, { new: true });
    let updated;
    try {
        const updateQuery = runUpdate();
        updated =
            typeof updateQuery.exec === 'function'
                ? await updateQuery.exec()
                : await updateQuery;
    }
    catch (error) {
        if (isBsonSizeError(error) && prev._id) {
            const normalizedId = prev._id instanceof mongoose_1.Types.ObjectId
                ? prev._id
                : mongoose_1.Types.ObjectId.isValid(String(prev._id))
                    ? new mongoose_1.Types.ObjectId(String(prev._id))
                    : undefined;
            if (!normalizedId) {
                throw error;
            }
            await persistHistoryEntryToArchive(normalizedId, entry);
            const retryQuery = model_1.Task.findOneAndUpdate(query, {
                $set: data,
            }, { new: true });
            updated =
                typeof retryQuery.exec === 'function'
                    ? await retryQuery.exec()
                    : await retryQuery;
        }
        else {
            throw error;
        }
    }
    if (updated) {
        updated = await hydrateTaskHistory(updated);
    }
    if (updated && Object.prototype.hasOwnProperty.call(fields, 'attachments')) {
        await syncTaskAttachments(updated._id, updated.attachments, userId);
    }
    else if (updated && enrichedAttachments !== undefined) {
        await syncTaskAttachments(updated._id, updated.attachments, userId);
    }
    if (updated) {
        await safeSyncVehicleAssignments(prev, updated);
    }
    return updated;
}
async function updateTaskStatus(id, status, userId, options = {}) {
    var _a, _b, _c;
    const existing = await model_1.Task.findById(id);
    if (!existing)
        return null;
    const source = (_a = options.source) !== null && _a !== void 0 ? _a : 'web';
    const currentStatus = typeof existing.status === 'string'
        ? existing.status
        : undefined;
    const assignedUserId = (0, assigneeIds_1.normalizeUserId)(existing.assigned_user_id);
    const assignees = (0, assigneeIds_1.collectAssigneeIds)(existing.assignees);
    const hasAssignments = assignedUserId !== null || assignees.length > 0;
    const isExecutor = (assignedUserId !== null && assignedUserId === userId) ||
        assignees.includes(userId);
    const creatorId = Number(existing.created_by);
    const isCreator = Number.isFinite(creatorId) && creatorId === userId;
    const isCancellation = status === 'Отменена';
    const isCompletion = status === 'Выполнена';
    // admin override flag (passed from routes.ts)
    const adminOverride = !!options.adminOverride;
    // Cancellation rules: only creator, only via web (existing behavior)
    if (isCancellation) {
        if (!isCreator) {
            const err = new Error('Статус «Отменена» может установить только создатель задачи.');
            err.code = 'TASK_CANCEL_FORBIDDEN';
            throw err;
        }
        if (source !== 'web') {
            const err = new Error('Отмена задачи в Telegram недоступна. Используйте веб-форму.');
            err.code = 'TASK_CANCEL_SOURCE_FORBIDDEN';
            throw err;
        }
    }
    // If task already in terminal state, only adminOverride may change it
    const terminalStatuses = ['Выполнена', 'Отменена'];
    if (typeof currentStatus === 'string' &&
        terminalStatuses.includes(currentStatus)) {
        // allow change only for adminOverride
        if (!adminOverride) {
            const err = new Error('Нельзя менять статус задачи, которая уже завершена или отменена.');
            err.code = 'TASK_STATUS_FORBIDDEN';
            throw err;
        }
    }
    // Completion rules: allow **creator OR executor** to set as completed
    if (isCompletion && !(isCreator || isExecutor || adminOverride)) {
        const err = new Error('Статус «Выполнена» может установить только создатель или исполнитель задачи.');
        err.code = 'TASK_STATUS_FORBIDDEN';
        throw err;
    }
    // If there are assignments, only creator/executor (or adminOverride) can change status
    if (hasAssignments &&
        !(isExecutor || isCreator || adminOverride) &&
        !(isCancellation && isCreator) // keep original creator-cancellation allowance
    ) {
        const err = new Error('Нет прав на изменение статуса задачи');
        err.code = 'TASK_STATUS_FORBIDDEN';
        throw err;
    }
    // (Optional) keep existing constraints about allowed previous statuses for completion.
    // The user requested to allow creator/executor to change to any status from any status,
    // so we skip strict "allowedCompletionSources" check. If you want to enforce a transition
    // matrix, add it here and throw TASK_STATUS_INVALID when not allowed.
    // Terminal / in-progress timestamps logic (preserve existing behavior)
    const isCompleted = status === 'Выполнена' || status === 'Отменена';
    const hasInProgressValue = existing.in_progress_at instanceof Date;
    const needsInProgressStart = status === 'В работе' && !hasInProgressValue;
    const needsInProgressReset = status === 'Новая' && existing.in_progress_at != null;
    const hasCompletedValue = existing.completed_at instanceof Date;
    const needsCompletedSet = isCompleted && !hasCompletedValue;
    const needsCompletedReset = !isCompleted && hasCompletedValue;
    if (existing.status === status &&
        !needsInProgressStart &&
        !needsInProgressReset &&
        !needsCompletedSet &&
        !needsCompletedReset) {
        return existing;
    }
    const update = { status };
    if (status === 'В работе') {
        update.in_progress_at = (_b = existing.in_progress_at) !== null && _b !== void 0 ? _b : new Date();
    }
    else if (status === 'Новая' && needsInProgressReset) {
        update.in_progress_at = null;
    }
    if (isCompleted) {
        update.completed_at = (_c = existing.completed_at) !== null && _c !== void 0 ? _c : new Date();
    }
    else if (needsCompletedReset) {
        update.completed_at = null;
    }
    // Preserve original call that records the change and returns the task
    return updateTask(id, update, userId);
}
async function getTasks(filters = {}, page, limit) {
    const isQuery = (v) => typeof v === 'object' && v !== null && 'exec' in v;
    if (filters.kanban) {
        const kindFilter = filters.kind === 'request' ? 'request' : 'task';
        const res = model_1.Task.find({ kind: kindFilter });
        if (isQuery(res)) {
            const list = await res.sort('-createdAt').exec();
            return { tasks: list, total: list.length };
        }
        const list = res;
        return { tasks: list, total: list.length };
    }
    const q = {};
    if (filters.kind === 'task' || filters.kind === 'request') {
        q.kind = filters.kind;
    }
    const statusFilter = filters.status;
    if (Array.isArray(statusFilter)) {
        const statuses = statusFilter
            .map((status) => (typeof status === 'string' ? status.trim() : ''))
            .filter((status) => status.length > 0);
        if (statuses.length === 1) {
            q.status = { $eq: statuses[0] };
        }
        else if (statuses.length > 1) {
            q.status = { $in: statuses };
        }
    }
    else if (typeof statusFilter === 'string') {
        const normalizedStatus = statusFilter.trim();
        if (normalizedStatus) {
            q.status = { $eq: normalizedStatus };
        }
    }
    if (filters.assignees && Array.isArray(filters.assignees)) {
        q.assignees = {
            $in: filters.assignees.map((a) => String(a)),
        };
    }
    const taskTypeFilter = filters.taskType;
    if (Array.isArray(taskTypeFilter)) {
        const types = taskTypeFilter
            .map((value) => (typeof value === 'string' ? value.trim() : ''))
            .filter((value) => value.length > 0);
        if (types.length === 1) {
            q.task_type = { $eq: types[0] };
        }
        else if (types.length > 1) {
            q.task_type = { $in: types };
        }
    }
    else if (typeof taskTypeFilter === 'string') {
        const normalizedType = taskTypeFilter.trim();
        if (normalizedType) {
            q.task_type = { $eq: normalizedType };
        }
    }
    if (filters.from || filters.to)
        q.createdAt = {};
    if (filters.from)
        q.createdAt.$gte = new Date(filters.from);
    if (filters.to)
        q.createdAt.$lte = new Date(filters.to);
    const res = model_1.Task.find(q);
    if (isQuery(res)) {
        let query = res.sort('-createdAt');
        const count = await model_1.Task.countDocuments(q);
        if (limit) {
            const p = Number(page) || 1;
            const l = Number(limit) || 25;
            query = query.skip((p - 1) * l).limit(l);
        }
        const list = await query.exec();
        return { tasks: list, total: count };
    }
    const list = res;
    return { tasks: list, total: list.length };
}
async function listRoutes(filters = {}) {
    const q = {};
    if (filters.status)
        q.status = { $eq: filters.status };
    if (filters.from || filters.to)
        q.createdAt = {};
    if (filters.from)
        q.createdAt.$gte = filters.from;
    if (filters.to)
        q.createdAt.$lte = filters.to;
    return model_1.Task.find(q).select('startCoordinates finishCoordinates route_distance_km status createdAt');
}
async function searchTasks(text) {
    const safe = escapeRegex(text);
    return model_1.Task.find({
        $or: [
            { title: { $regex: safe, $options: 'i' } },
            { task_description: { $regex: safe, $options: 'i' } },
        ],
    }).limit(10);
}
async function addTime(id, minutes, userId = 0) {
    const task = await model_1.Task.findById(id);
    if (!task)
        return null;
    const normalizedId = task._id instanceof mongoose_1.Types.ObjectId
        ? task._id
        : mongoose_1.Types.ObjectId.isValid(String(task._id))
            ? new mongoose_1.Types.ObjectId(String(task._id))
            : null;
    if (!normalizedId) {
        throw new Error('Не удалось определить идентификатор задачи для обновления времени');
    }
    const before = task.time_spent || 0;
    const nextValue = before + minutes;
    const entry = {
        changed_at: new Date(),
        changed_by: userId,
        changes: {
            from: { time_spent: before },
            to: { time_spent: nextValue },
        },
    };
    const baseQuery = { _id: normalizedId };
    const runUpdate = () => model_1.Task.findOneAndUpdate(baseQuery, {
        $set: { time_spent: nextValue },
        $push: { history: entry },
    }, { new: true });
    let updated;
    try {
        const query = runUpdate();
        updated =
            typeof query.exec === 'function' ? await query.exec() : await query;
    }
    catch (error) {
        if (isBsonSizeError(error)) {
            await persistHistoryEntryToArchive(normalizedId, entry);
            const retryQuery = model_1.Task.findOneAndUpdate(baseQuery, {
                $set: { time_spent: nextValue },
            }, { new: true });
            updated =
                typeof retryQuery.exec === 'function'
                    ? await retryQuery.exec()
                    : await retryQuery;
        }
        else {
            throw error;
        }
    }
    if (updated) {
        updated = await hydrateTaskHistory(updated);
    }
    return updated;
}
async function bulkUpdate(ids, data) {
    const payload = { ...data };
    if (Object.prototype.hasOwnProperty.call(payload, 'kind')) {
        delete payload.kind;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
        const status = payload.status;
        const isCompleted = status === 'Выполнена' || status === 'Отменена';
        if (status === 'В работе') {
            payload.in_progress_at = new Date();
        }
        else if (status === 'Новая') {
            payload.in_progress_at = null;
        }
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
    await model_1.Task.updateMany({ _id: { $in: ids } }, {
        $set: payload,
        $push: {
            history: {
                changed_at: new Date(),
                changed_by: 0,
                changes: { from: {}, to: payload },
            },
        },
    });
}
async function deleteTask(id, actorId) {
    const doc = await model_1.Task.findByIdAndDelete(id);
    if (!doc)
        return null;
    const data = doc.toObject();
    const attachments = Array.isArray(data.attachments)
        ? data.attachments
        : [];
    const fileIds = (0, attachments_1.extractAttachmentIds)(attachments);
    await (0, dataStorage_1.deleteFilesForTask)(doc._id, fileIds);
    const fallbackUserId = typeof data.created_by === 'number' && Number.isFinite(data.created_by)
        ? data.created_by
        : 0;
    if (Array.isArray(data.history) && data.history.length > 0) {
        const normalized = data.history.map((entry) => {
            if (entry && typeof entry === 'object') {
                const withFallback = { ...entry };
                const changedBy = withFallback.changed_by;
                if (typeof changedBy !== 'number' || !Number.isFinite(changedBy)) {
                    withFallback.changed_by = fallbackUserId;
                }
                return withFallback;
            }
            return {
                changed_at: new Date(),
                changed_by: fallbackUserId,
                changes: { from: {}, to: {} },
            };
        });
        data.history = normalized;
    }
    data.request_id = `${data.request_id}-DEL`;
    data.task_number = data.request_id;
    data.archived_at = new Date();
    if (typeof actorId === 'number' && Number.isFinite(actorId)) {
        data.archived_by = actorId;
    }
    await model_1.Archive.create(data);
    return doc;
}
async function listArchivedTasks(params = {}) {
    const pageRaw = Number(params.page);
    const limitRaw = Number(params.limit);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), 200)
        : 25;
    const filter = {};
    const search = typeof params.search === 'string' ? params.search.trim() : '';
    if (search) {
        const safe = escapeRegex(search);
        filter.$or = [
            { request_id: { $regex: safe, $options: 'i' } },
            { task_number: { $regex: safe, $options: 'i' } },
            { title: { $regex: safe, $options: 'i' } },
        ];
    }
    const query = model_1.Archive.find(filter)
        .sort({ archived_at: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    const [items, total] = await Promise.all([
        query,
        model_1.Archive.countDocuments(filter),
    ]);
    const pages = limit > 0 ? Math.ceil(total / limit) : 0;
    return { items, total, page, pages };
}
async function purgeArchivedTasks(ids) {
    const normalized = Array.isArray(ids)
        ? ids
            .map((id) => (typeof id === 'string' ? id.trim() : ''))
            .filter((id) => mongoose_1.Types.ObjectId.isValid(id))
            .map((id) => new mongoose_1.Types.ObjectId(id))
        : [];
    if (!normalized.length) {
        return 0;
    }
    const result = await model_1.Archive.deleteMany({ _id: { $in: normalized } });
    return typeof result.deletedCount === 'number' ? result.deletedCount : 0;
}
const getCurrentTimeZone = () => {
    try {
        const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return resolved || 'UTC';
    }
    catch {
        return 'UTC';
    }
};
const toDateSafe = (value) => {
    if (!value)
        return undefined;
    const candidate = new Date(value);
    return Number.isFinite(candidate.getTime()) ? candidate : undefined;
};
const startOfDay = (value) => {
    const result = new Date(value);
    result.setHours(0, 0, 0, 0);
    return result;
};
const endOfDay = (value) => {
    const result = new Date(value);
    result.setHours(23, 59, 59, 999);
    return result;
};
async function tasksChart(filters = {}) {
    var _a, _b;
    const now = new Date();
    const toCandidate = (_a = toDateSafe(filters.to)) !== null && _a !== void 0 ? _a : now;
    const fromCandidate = toDateSafe(filters.from);
    const rangeEnd = endOfDay(toCandidate);
    const rangeStart = startOfDay(fromCandidate && fromCandidate.getTime() <= rangeEnd.getTime()
        ? fromCandidate
        : new Date(toCandidate.getTime() - 6 * 24 * 60 * 60 * 1000));
    const match = {
        createdAt: {
            $gte: rangeStart,
            $lte: rangeEnd,
        },
    };
    if (filters.kind === 'task' || filters.kind === 'request') {
        match.kind = filters.kind;
    }
    if (filters.status) {
        match.status = filters.status;
    }
    if (filters.assignees && filters.assignees.length > 0) {
        match.assignees = { $in: filters.assignees };
    }
    const timeZone = getCurrentTimeZone();
    const dayFormatter = new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        timeZone,
    });
    const isoDayFormatter = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone,
    });
    const pipeline = [
        { $match: match },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: '%Y-%m-%d',
                        date: '$createdAt',
                        timezone: timeZone,
                    },
                },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ];
    const aggregated = await model_1.Task.aggregate(pipeline);
    const counts = new Map();
    aggregated.forEach((entry) => {
        var _a;
        if (entry && typeof entry === 'object') {
            const key = typeof entry._id === 'string' ? entry._id : undefined;
            const value = Number((_a = entry.count) !== null && _a !== void 0 ? _a : 0);
            if (key)
                counts.set(key, Number.isFinite(value) ? value : 0);
        }
    });
    const labels = [];
    const data = [];
    const endDay = startOfDay(rangeEnd);
    for (let cursor = startOfDay(rangeStart); cursor <= endDay;) {
        const isoKey = isoDayFormatter.format(cursor);
        labels.push(dayFormatter.format(cursor));
        data.push((_b = counts.get(isoKey)) !== null && _b !== void 0 ? _b : 0);
        cursor.setDate(cursor.getDate() + 1);
    }
    return { labels, data };
}
async function summary(filters = {}) {
    const match = {};
    if (filters.kind === 'task' || filters.kind === 'request') {
        match.kind = filters.kind;
    }
    if (filters.status)
        match.status = filters.status;
    if (filters.assignees)
        match.assignees = { $in: filters.assignees };
    if (filters.from || filters.to)
        match.createdAt = {};
    if (filters.from)
        match.createdAt.$gte = filters.from;
    if (filters.to)
        match.createdAt.$lte = filters.to;
    const pipeline = [
        Object.keys(match).length ? { $match: match } : undefined,
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                time: { $sum: '$time_spent' },
            },
        },
    ];
    const res = await model_1.Task.aggregate(pipeline.filter((s) => Boolean(s)));
    const { count = 0, time = 0 } = (res[0] || {});
    return { count, time };
}
function parseTelegramId(id) {
    if (id === undefined || id === null)
        return undefined;
    const asString = String(id).trim();
    if (!asString)
        return undefined;
    const numeric = Number(asString);
    if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
        throw new Error('Invalid telegram_id');
    }
    return numeric;
}
async function ensureTelegramIdAvailable(id) {
    const exists = await model_1.User.exists({ telegram_id: id });
    if (exists) {
        throw new Error('Пользователь с таким ID уже существует');
    }
}
async function findNextTelegramId() {
    const last = await model_1.User.findOne({}, { telegram_id: 1 })
        .sort({ telegram_id: -1 })
        .lean()
        .exec();
    let candidate = typeof (last === null || last === void 0 ? void 0 : last.telegram_id) === 'number' && Number.isFinite(last.telegram_id)
        ? last.telegram_id + 1
        : 1;
    while (await model_1.User.exists({ telegram_id: candidate })) {
        candidate += 1;
        if (!Number.isFinite(candidate) || candidate > Number.MAX_SAFE_INTEGER) {
            throw new Error('Не удалось подобрать свободный ID');
        }
    }
    return candidate;
}
function normalizeUsernameValue(value) {
    if (value === undefined || value === null)
        return undefined;
    const trimmed = String(value).trim();
    return trimmed || undefined;
}
async function ensureUsernameAvailable(username) {
    const exists = await model_1.User.exists({ username });
    if (exists) {
        throw new Error('Username уже используется');
    }
}
async function generateUsername(base) {
    let attempt = 0;
    let candidate = base;
    while (await model_1.User.exists({ username: candidate })) {
        attempt += 1;
        if (attempt > 1000) {
            throw new Error('Не удалось подобрать свободный username');
        }
        candidate = `${base}_${attempt}`;
    }
    return candidate;
}
async function generateUserCredentials(id, username) {
    const parsedId = parseTelegramId(id);
    let telegramId;
    if (parsedId !== undefined) {
        await ensureTelegramIdAvailable(parsedId);
        telegramId = parsedId;
    }
    else {
        telegramId = await findNextTelegramId();
    }
    const normalizedUsername = normalizeUsernameValue(username);
    if (normalizedUsername) {
        await ensureUsernameAvailable(normalizedUsername);
        return { telegramId, username: normalizedUsername };
    }
    const base = `employee${telegramId}`;
    const generated = await generateUsername(base);
    return { telegramId, username: generated };
}
async function assertCredentialsAvailable({ telegramId, username, }) {
    await ensureTelegramIdAvailable(telegramId);
    await ensureUsernameAvailable(username);
}
async function createUser(id, username, roleId, extra = {}) {
    const credentials = await generateUserCredentials(id, username);
    await assertCredentialsAvailable(credentials);
    const { telegramId, username: safeUsername } = credentials;
    const email = `${telegramId}@telegram.local`;
    let role = 'user';
    let rId = null;
    if (roleId) {
        if (!mongoose_1.Types.ObjectId.isValid(roleId)) {
            throw new Error('Invalid roleId');
        }
        const dbRole = await model_1.Role.findById(roleId);
        if (dbRole) {
            role = dbRole.name || 'user';
            rId = dbRole._id;
        }
    }
    if (!rId) {
        rId = await (0, roleCache_1.resolveRoleId)('user');
        if (!rId) {
            throw new Error('Не найдена базовая роль user');
        }
        role = 'user';
    }
    const access = accessByRole(role);
    return model_1.User.create({
        telegram_id: telegramId,
        username: safeUsername,
        email,
        name: safeUsername,
        role,
        roleId: rId,
        access,
        ...extra,
    });
}
async function getUser(id) {
    const telegramId = Number(id);
    if (Number.isNaN(telegramId))
        return null;
    return model_1.User.findOne({ telegram_id: telegramId });
}
async function listUsers() {
    return model_1.User.find();
}
async function removeUser(id) {
    const telegramId = Number(id);
    if (Number.isNaN(telegramId)) {
        return false;
    }
    const result = await model_1.User.deleteOne({ telegram_id: { $eq: telegramId } });
    return result.deletedCount === 1;
}
async function getUsersMap(ids = []) {
    const numeric = ids.map((id) => Number(id)).filter((id) => !Number.isNaN(id));
    const list = await model_1.User.find({ telegram_id: { $in: numeric } });
    const map = {};
    list.forEach((u) => {
        map[u.telegram_id] = u;
    });
    return map;
}
async function updateUser(id, data) {
    const telegramId = Number(id);
    if (Number.isNaN(telegramId))
        return null;
    const previous = await model_1.User.findOne({ telegram_id: { $eq: telegramId } }, { access: 1 })
        .lean()
        .exec();
    const sanitized = sanitizeUpdate(data);
    delete sanitized.access;
    if (sanitized.roleId) {
        const rId = String(sanitized.roleId);
        if (!mongoose_1.Types.ObjectId.isValid(rId))
            throw new Error('Invalid roleId');
        const dbRole = await model_1.Role.findById(rId);
        if (dbRole) {
            const r = dbRole.name || 'user';
            sanitized.role = r;
            sanitized.roleId = dbRole._id;
            sanitized.access = accessByRole(r);
        }
    }
    else if (sanitized.role) {
        sanitized.access = accessByRole(sanitized.role);
        const resolved = await (0, roleCache_1.resolveRoleId)(sanitized.role);
        if (resolved) {
            sanitized.roleId = resolved;
        }
        else {
            delete sanitized.roleId;
        }
    }
    if (typeof sanitized.access === 'number') {
        const previousAccess = typeof (previous === null || previous === void 0 ? void 0 : previous.access) === 'number' ? previous.access : null;
        if (previousAccess !== null &&
            (previousAccess & accessMask_1.ACCESS_TASK_DELETE) === accessMask_1.ACCESS_TASK_DELETE) {
            sanitized.access |= accessMask_1.ACCESS_TASK_DELETE;
        }
    }
    return model_1.User.findOneAndUpdate({ telegram_id: { $eq: telegramId } }, sanitized, { new: true });
}
async function listRoles() {
    const roles = await model_1.Role.find().lean();
    return roles.map((r) => ({
        ...r,
        access: accessByRole(r.name || ''),
    }));
}
async function getRole(id) {
    return model_1.Role.findById(id);
}
async function updateRole(id, permissions) {
    const sanitizedPermissions = Array.isArray(permissions)
        ? permissions.filter((item) => typeof item === 'string' || typeof item === 'number')
        : [];
    return model_1.Role.findByIdAndUpdate(id, { permissions: sanitizedPermissions }, { new: true });
}
async function createTaskTemplate(data) {
    return model_1.TaskTemplate.create(data);
}
async function getTaskTemplate(id) {
    return model_1.TaskTemplate.findById(id);
}
async function listTaskTemplates() {
    return model_1.TaskTemplate.find();
}
async function deleteTaskTemplate(id) {
    return model_1.TaskTemplate.findByIdAndDelete(id);
}
exports.default = {
    createTask,
    listMentionedTasks,
    updateTask,
    updateTaskStatus,
    getTask,
    getTasks,
    addTime,
    bulkUpdate,
    deleteTask,
    summary,
    chart: tasksChart,
    tasksChart,
    createUser,
    generateUserCredentials,
    getUser,
    listUsers,
    removeUser,
    getUsersMap,
    updateUser,
    listRoles,
    getRole,
    updateRole,
    writeLog: logEngine.writeLog,
    listLogs: logEngine.listLogs,
    searchTasks,
    createTaskTemplate,
    getTaskTemplate,
    listTaskTemplates,
    deleteTaskTemplate,
    listRoutes,
    listArchivedTasks,
    purgeArchivedTasks,
};
