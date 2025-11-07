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
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
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
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Контроллер задач с использованием TasksService
// Основные модули: express-validator, services, wgLogEngine, utils/mdEscape
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = __importDefault(require("node:os"));
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const tsyringe_1 = require("tsyringe");
const validate_1 = require("../utils/validate");
const service_1 = require("../services/service");
const queries_1 = require("../db/queries");
const model_1 = require("../db/model");
const fleet_1 = require("../db/models/fleet");
const CollectionItem_1 = require("../db/models/CollectionItem");
const problem_1 = require("../utils/problem");
const sendCached_1 = require("../utils/sendCached");
const bot_1 = require("../bot/bot");
const taskLinks_1 = require("./taskLinks");
const config_1 = require("../config");
const taskButtons_1 = __importStar(require("../utils/taskButtons"));
const formatTask_1 = __importDefault(require("../utils/formatTask"));
const messageLink_1 = __importDefault(require("../utils/messageLink"));
const delay_1 = __importDefault(require("../utils/delay"));
const storage_1 = require("../config/storage");
const mdEscape_1 = __importDefault(require("../utils/mdEscape"));
const sharp_1 = __importDefault(require("sharp"));
const taskTypeSettings_1 = require("../services/taskTypeSettings");
const accessMask_1 = require("../utils/accessMask");
const taskComments_1 = require("../tasks/taskComments");
const requestUploads_1 = require("../utils/requestUploads");
const filterUtils_1 = require("./filterUtils");
const uploadFinalizer_1 = require("./uploadFinalizer");
const FILE_ID_REGEXP = /\/api\/v1\/files\/([0-9a-f]{24})(?=$|[/?#])/i;
const uploadsAbsoluteDir = node_path_1.default.resolve(storage_1.uploadsDir);
const baseAppHost = (() => {
    try {
        return new URL(config_1.appUrl).host;
    }
    catch {
        return null;
    }
})();
const resolveGroupChatId = () => typeof config_1.getChatId === 'function' ? (0, config_1.getChatId)() : config_1.chatId;
const HTTP_URL_REGEXP = /^https?:\/\//i;
const YOUTUBE_URL_REGEXP = /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\//i;
const attachmentsBaseUrl = config_1.appUrl.replace(/\/+$/, '');
const ALBUM_MESSAGE_DELAY_MS = 100;
const REQUEST_TYPE_NAME = 'Заявка';
const cleanupRequestUploads = async (req) => {
    await (0, requestUploads_1.cleanupUploadedFiles)(req).catch(() => undefined);
    await (0, uploadFinalizer_1.purgeTemporaryUploads)(req).catch(() => undefined);
};
const detectTaskKind = (task) => {
    if (!task || typeof task !== 'object') {
        return 'task';
    }
    const source = task;
    const rawKind = typeof source.kind === 'string' ? source.kind.trim() : '';
    if (rawKind === 'request')
        return 'request';
    const typeValue = typeof source.task_type === 'string' ? source.task_type.trim() : '';
    return typeValue === REQUEST_TYPE_NAME ? 'request' : 'task';
};
const resolveTaskLabel = (kind) => kind === 'request' ? 'Заявка' : 'Задача';
const hasAdminAccess = (role, access) => {
    const roleName = typeof role === 'string' ? role : '';
    if (roleName === 'admin')
        return true;
    const mask = typeof access === 'number' ? access : 0;
    return (mask & accessMask_1.ACCESS_ADMIN) === accessMask_1.ACCESS_ADMIN;
};
const toAbsoluteAttachmentUrl = (url) => {
    const trimmed = url.trim();
    if (!trimmed)
        return null;
    if (HTTP_URL_REGEXP.test(trimmed)) {
        return trimmed;
    }
    if (trimmed.startsWith('//')) {
        return `https:${trimmed}`;
    }
    if (!attachmentsBaseUrl) {
        return null;
    }
    const normalizedPath = trimmed.startsWith('/')
        ? trimmed.slice(1)
        : trimmed;
    return `${attachmentsBaseUrl}/${normalizedPath}`;
};
const SUPPORTED_PHOTO_MIME_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/pjpeg',
    'image/png',
    'image/webp',
    'image/gif',
]);
const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
const TELEGRAM_MESSAGE_LIMIT = 4096;
const hasOddTrailingBackslash = (value) => {
    const match = value.match(/\\+$/);
    if (!match) {
        return false;
    }
    return match[0].length % 2 === 1;
};
const adjustBreakIndex = (text, index) => {
    let candidate = Math.min(Math.max(index, 1), text.length);
    while (candidate > 0) {
        const prefix = text.slice(0, candidate);
        if (!hasOddTrailingBackslash(prefix)) {
            break;
        }
        candidate -= 1;
    }
    return candidate;
};
const findBreakIndex = (text, limit) => {
    const windowEnd = Math.min(limit + 1, text.length);
    const window = text.slice(0, windowEnd);
    const doubleNewlineIndex = window.lastIndexOf('\n\n');
    if (doubleNewlineIndex >= 0) {
        return doubleNewlineIndex + 2;
    }
    const newlineIndex = window.lastIndexOf('\n');
    if (newlineIndex >= 0) {
        return newlineIndex + 1;
    }
    const spaceIndex = window.lastIndexOf(' ');
    if (spaceIndex >= 0) {
        return spaceIndex + 1;
    }
    return Math.min(limit, text.length);
};
const splitMessageForTelegramLimit = (text, limit) => {
    const normalized = typeof text === 'string' ? text : '';
    if (!normalized) {
        return [];
    }
    if (normalized.length <= limit) {
        return [normalized];
    }
    const parts = [];
    let remaining = normalized;
    while (remaining.length > limit) {
        let breakIndex = findBreakIndex(remaining, limit);
        breakIndex = adjustBreakIndex(remaining, breakIndex);
        if (breakIndex <= 0 || breakIndex >= remaining.length) {
            breakIndex = Math.min(limit, remaining.length);
        }
        let chunk = remaining.slice(0, breakIndex);
        if (!chunk.trim()) {
            chunk = remaining.slice(0, Math.min(limit, remaining.length));
            breakIndex = chunk.length;
        }
        if (!chunk) {
            break;
        }
        parts.push(chunk);
        remaining = remaining.slice(breakIndex).replace(/^[\n\r]+/, '');
    }
    if (remaining.length) {
        parts.push(remaining);
    }
    return parts;
};
let TasksController = (() => {
    let _classDecorators = [(0, tsyringe_1.injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var TasksController = _classThis = class {
        constructor(service, reportGenerator) {
            this.service = service;
            this.reportGenerator = reportGenerator;
            this.botApiPhotoErrorPatterns = [
                /\bIMAGE_PROCESS_FAILED\b/,
                /\bPHOTO_[A-Z_]+\b/,
                /\bFILE_TOO_BIG\b/,
                /\bFILE_UPLOAD_[A-Z_]+\b/,
                /\bFILE_SIZE_[A-Z_]+\b/,
            ];
            this.downloadPdf = async (req, res) => {
                try {
                    const filters = { ...req.query };
                    const result = await this.reportGenerator.generatePdf(filters, req.user);
                    res.setHeader('Content-Type', result.contentType);
                    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
                    res.setHeader('Content-Length', String(result.data.length));
                    res.send(result.data);
                }
                catch (error) {
                    console.error('Не удалось сформировать PDF отчёт задач', error);
                    (0, problem_1.sendProblem)(req, res, {
                        type: 'about:blank',
                        title: 'Ошибка генерации отчёта',
                        status: 500,
                        detail: 'Не удалось сформировать PDF отчёт',
                    });
                }
            };
            this.downloadExcel = async (req, res) => {
                try {
                    const filters = { ...req.query };
                    const result = await this.reportGenerator.generateExcel(filters, req.user);
                    res.setHeader('Content-Type', result.contentType);
                    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
                    res.setHeader('Content-Length', String(result.data.length));
                    res.send(result.data);
                }
                catch (error) {
                    console.error('Не удалось сформировать Excel отчёт задач', error);
                    (0, problem_1.sendProblem)(req, res, {
                        type: 'about:blank',
                        title: 'Ошибка генерации отчёта',
                        status: 500,
                        detail: 'Не удалось сформировать Excel отчёт',
                    });
                }
            };
            this.list = async (req, res) => {
                const { page, limit, ...filters } = req.query;
                const pageNumber = page ? Number(page) : undefined;
                const limitNumber = limit ? Number(limit) : undefined;
                const { normalized: normalizedFilters, statusValues, taskTypeValues, assigneeValues, kindFilter, } = (0, filterUtils_1.normalizeTaskFilters)(filters);
                let tasks;
                let total = 0;
                if (['admin', 'manager'].includes(req.user.role || '')) {
                    const result = await this.service.get(normalizedFilters, pageNumber, limitNumber);
                    tasks = result.tasks;
                    total = result.total;
                }
                else {
                    tasks = (await this.service.mentioned(String(req.user.id)));
                    if (kindFilter) {
                        tasks = tasks.filter((task) => detectTaskKind(task) === kindFilter);
                    }
                    if (statusValues.length) {
                        const statusSet = new Set(statusValues);
                        tasks = tasks.filter((task) => typeof task.status === 'string' ? statusSet.has(task.status.trim()) : false);
                    }
                    if (taskTypeValues.length) {
                        const typeSet = new Set(taskTypeValues);
                        tasks = tasks.filter((task) => {
                            const typeValue = typeof task.task_type === 'string'
                                ? task.task_type.trim()
                                : '';
                            return typeValue ? typeSet.has(typeValue) : false;
                        });
                    }
                    if (assigneeValues.length) {
                        const assigneeSet = new Set(assigneeValues.map((id) => Number(id)));
                        tasks = tasks.filter((task) => {
                            const recipients = new Set();
                            const collect = (value) => {
                                if (typeof value === 'number' && Number.isFinite(value)) {
                                    recipients.add(value);
                                }
                                else if (typeof value === 'string') {
                                    const parsed = Number(value.trim());
                                    if (Number.isFinite(parsed)) {
                                        recipients.add(parsed);
                                    }
                                }
                            };
                            if (Array.isArray(task.assignees)) {
                                task.assignees.forEach(collect);
                            }
                            collect(task.assigned_user_id);
                            return Array.from(recipients).some((recipient) => assigneeSet.has(recipient));
                        });
                    }
                    total = tasks.length;
                }
                const ids = new Set();
                tasks.forEach((t) => {
                    (t.assignees || []).forEach((id) => ids.add(id));
                    (t.controllers || []).forEach((id) => ids.add(id));
                    if (t.created_by)
                        ids.add(t.created_by);
                    if (typeof t.transport_driver_id === 'number')
                        ids.add(t.transport_driver_id);
                    (t.history || []).forEach((h) => ids.add(h.changed_by));
                });
                const users = await (0, queries_1.getUsersMap)(Array.from(ids));
                (0, sendCached_1.sendCached)(req, res, { tasks, users, total });
            };
            this.detail = async (req, res) => {
                const task = (await this.service.getById(req.params.id));
                if (!task) {
                    (0, problem_1.sendProblem)(req, res, {
                        type: 'about:blank',
                        title: 'Задача не найдена',
                        status: 404,
                        detail: 'Not Found',
                    });
                    return;
                }
                const ids = new Set();
                (task.assignees || []).forEach((id) => ids.add(id));
                (task.controllers || []).forEach((id) => ids.add(id));
                if (task.created_by)
                    ids.add(task.created_by);
                if (typeof task.transport_driver_id === 'number')
                    ids.add(task.transport_driver_id);
                (task.history || []).forEach((h) => ids.add(h.changed_by));
                const users = await (0, queries_1.getUsersMap)(Array.from(ids));
                res.json({ task, users });
            };
            this.create = [
                validate_1.handleValidation,
                async (req, res) => {
                    const actorId = Number(req.user.id);
                    const payload = req.body;
                    const detectedKind = detectTaskKind(payload);
                    if (detectedKind === 'request') {
                        const source = Array.isArray(payload.assignees)
                            ? [...payload.assignees]
                            : [];
                        if (payload.assigned_user_id !== undefined) {
                            source.push(payload.assigned_user_id);
                        }
                        const allowed = await this.resolveAdminExecutors(source);
                        if (!allowed.length) {
                            await cleanupRequestUploads(req);
                            (0, problem_1.sendProblem)(req, res, {
                                type: 'about:blank',
                                title: 'Исполнители недоступны',
                                status: 403,
                                detail: 'Для заявки можно выбрать только администратора',
                            });
                            return;
                        }
                        payload.kind = 'request';
                        payload.task_type = REQUEST_TYPE_NAME;
                        payload.status = 'Новая';
                        payload.created_by = actorId;
                        payload.assignees = allowed;
                        payload.assigned_user_id = allowed[0];
                    }
                    else {
                        payload.kind = 'task';
                    }
                    let task;
                    try {
                        task = (await this.service.create(payload, actorId));
                    }
                    catch (error) {
                        await cleanupRequestUploads(req);
                        const err = error;
                        if (err.code === 'TRANSPORT_FIELDS_REQUIRED') {
                            (0, problem_1.sendProblem)(req, res, {
                                type: 'about:blank',
                                title: 'Транспорт не заполнен',
                                status: 422,
                                detail: 'Укажите водителя и транспорт для выбранного типа',
                            });
                            return;
                        }
                        throw error;
                    }
                    try {
                        const finalizeResult = await (0, uploadFinalizer_1.finalizePendingUploads)({
                            req,
                            taskId: String(task._id),
                            attachments: Array.isArray(payload.attachments)
                                ? payload.attachments
                                : undefined,
                        });
                        payload.attachments =
                            finalizeResult.attachments;
                        task.attachments =
                            finalizeResult.attachments;
                    }
                    catch (error) {
                        await cleanupRequestUploads(req);
                        throw error;
                    }
                    const label = resolveTaskLabel(detectTaskKind(task));
                    await (0, service_1.writeLog)(`Создана ${label.toLowerCase()} ${task._id} пользователем ${req.user.id}/${req.user.username}`);
                    res.status(201).json(task);
                    void this.notifyTaskCreated(task, actorId).catch((error) => {
                        console.error('Не удалось отправить уведомление о создании задачи', error);
                    });
                },
            ];
            this.createRequest = [
                validate_1.handleValidation,
                async (req, res) => {
                    const actorId = Number(req.user.id);
                    const payload = req.body;
                    const source = Array.isArray(payload.assignees)
                        ? [...payload.assignees]
                        : [];
                    if (payload.assigned_user_id !== undefined) {
                        source.push(payload.assigned_user_id);
                    }
                    const allowed = await this.resolveAdminExecutors(source);
                    if (!allowed.length) {
                        await cleanupRequestUploads(req);
                        (0, problem_1.sendProblem)(req, res, {
                            type: 'about:blank',
                            title: 'Исполнители недоступны',
                            status: 403,
                            detail: 'Для заявки можно выбрать только администратора',
                        });
                        return;
                    }
                    payload.kind = 'request';
                    payload.task_type = REQUEST_TYPE_NAME;
                    payload.status = 'Новая';
                    payload.created_by = actorId;
                    payload.assignees = allowed;
                    payload.assigned_user_id = allowed[0];
                    let task;
                    try {
                        task = (await this.service.create(payload, actorId));
                    }
                    catch (error) {
                        await cleanupRequestUploads(req);
                        throw error;
                    }
                    try {
                        const finalizeResult = await (0, uploadFinalizer_1.finalizePendingUploads)({
                            req,
                            taskId: String(task._id),
                            attachments: Array.isArray(payload.attachments)
                                ? payload.attachments
                                : undefined,
                        });
                        payload.attachments =
                            finalizeResult.attachments;
                        task.attachments =
                            finalizeResult.attachments;
                    }
                    catch (error) {
                        await cleanupRequestUploads(req);
                        throw error;
                    }
                    await (0, service_1.writeLog)(`Создана заявка ${task._id} пользователем ${req.user.id}/${req.user.username}`);
                    res.status(201).json(task);
                    void this.notifyTaskCreated(task, actorId).catch((error) => {
                        console.error('Не удалось отправить уведомление о создании задачи', error);
                    });
                },
            ];
            this.update = [
                validate_1.handleValidation,
                async (req, res) => {
                    const previousRaw = await model_1.Task.findById(req.params.id);
                    const previousTask = previousRaw
                        ? (typeof previousRaw.toObject === 'function'
                            ? previousRaw.toObject()
                            : previousRaw)
                        : null;
                    if (!previousTask) {
                        await cleanupRequestUploads(req);
                        (0, problem_1.sendProblem)(req, res, {
                            type: 'about:blank',
                            title: 'Задача не найдена',
                            status: 404,
                            detail: 'Not Found',
                        });
                        return;
                    }
                    const actorIdRaw = req.user?.id;
                    const actorId = typeof actorIdRaw === 'number' && Number.isFinite(actorIdRaw)
                        ? actorIdRaw
                        : typeof actorIdRaw === 'string'
                            ? Number(actorIdRaw.trim())
                            : Number.NaN;
                    if (!Number.isFinite(actorId)) {
                        await cleanupRequestUploads(req);
                        (0, problem_1.sendProblem)(req, res, {
                            type: 'about:blank',
                            title: 'Ошибка авторизации',
                            status: 403,
                            detail: 'Не удалось определить пользователя',
                        });
                        return;
                    }
                    const nextPayload = req.body;
                    const previousKind = detectTaskKind(previousTask);
                    if (previousKind === 'request') {
                        if (typeof nextPayload.kind === 'string' &&
                            nextPayload.kind.trim() !== 'request') {
                            await cleanupRequestUploads(req);
                            (0, problem_1.sendProblem)(req, res, {
                                type: 'about:blank',
                                title: 'Изменение типа запрещено',
                                status: 409,
                                detail: 'Заявку нельзя преобразовать в задачу',
                            });
                            return;
                        }
                        if (Object.prototype.hasOwnProperty.call(nextPayload, 'task_type') &&
                            typeof nextPayload.task_type === 'string' &&
                            nextPayload.task_type.trim() !== REQUEST_TYPE_NAME) {
                            await cleanupRequestUploads(req);
                            (0, problem_1.sendProblem)(req, res, {
                                type: 'about:blank',
                                title: 'Изменение типа запрещено',
                                status: 409,
                                detail: 'Заявку нельзя преобразовать в задачу',
                            });
                            return;
                        }
                        if (Object.prototype.hasOwnProperty.call(nextPayload, 'assignees') ||
                            Object.prototype.hasOwnProperty.call(nextPayload, 'assigned_user_id')) {
                            const source = Array.isArray(nextPayload.assignees)
                                ? [...nextPayload.assignees]
                                : [];
                            if (nextPayload.assigned_user_id !== undefined) {
                                source.push(nextPayload.assigned_user_id);
                            }
                            const allowed = await this.resolveAdminExecutors(source);
                            if (!allowed.length) {
                                await cleanupRequestUploads(req);
                                (0, problem_1.sendProblem)(req, res, {
                                    type: 'about:blank',
                                    title: 'Исполнители недоступны',
                                    status: 403,
                                    detail: 'Для заявки можно выбрать только администратора',
                                });
                                return;
                            }
                            nextPayload.assignees = allowed;
                            const assignedNumeric = Number(nextPayload.assigned_user_id);
                            nextPayload.assigned_user_id = allowed.includes(assignedNumeric)
                                ? assignedNumeric
                                : allowed[0];
                        }
                        nextPayload.kind = 'request';
                        nextPayload.task_type = REQUEST_TYPE_NAME;
                    }
                    const currentStatus = typeof previousTask.status === 'string'
                        ? previousTask.status
                        : undefined;
                    const isCreator = Number.isFinite(Number(req.user?.id)) &&
                        Number(previousTask.created_by) === Number(req.user?.id);
                    if (currentStatus && currentStatus !== 'Новая' && !isCreator) {
                        await cleanupRequestUploads(req);
                        (0, problem_1.sendProblem)(req, res, {
                            type: 'about:blank',
                            title: 'Редактирование запрещено',
                            status: 409,
                            detail: 'Редактирование доступно только для задач в статусе «Новая»',
                        });
                        return;
                    }
                    let task;
                    try {
                        task = await this.service.update(req.params.id, req.body, actorId);
                    }
                    catch (error) {
                        await cleanupRequestUploads(req);
                        const err = error;
                        if (err.code === 'TRANSPORT_FIELDS_REQUIRED') {
                            (0, problem_1.sendProblem)(req, res, {
                                type: 'about:blank',
                                title: 'Транспорт не заполнен',
                                status: 422,
                                detail: 'Укажите водителя и транспорт для выбранного типа',
                            });
                            return;
                        }
                        if (err.code === 'TASK_CANCEL_FORBIDDEN' ||
                            err.code === 'TASK_REQUEST_CANCEL_FORBIDDEN' ||
                            err.code === 'TASK_CANCEL_SOURCE_FORBIDDEN') {
                            await cleanupRequestUploads(req);
                            (0, problem_1.sendProblem)(req, res, {
                                type: 'about:blank',
                                title: 'Доступ запрещён',
                                status: 403,
                                detail: err.message || 'Нет прав для изменения статуса',
                            });
                            return;
                        }
                        throw error;
                    }
                    if (!task) {
                        const current = await model_1.Task.findById(req.params.id);
                        if (current &&
                            typeof current.status === 'string' &&
                            current.status !== 'Новая' &&
                            !isCreator) {
                            await cleanupRequestUploads(req);
                            (0, problem_1.sendProblem)(req, res, {
                                type: 'about:blank',
                                title: 'Редактирование запрещено',
                                status: 409,
                                detail: 'Редактирование доступно только для задач в статусе «Новая»',
                            });
                        }
                        else {
                            await cleanupRequestUploads(req);
                            (0, problem_1.sendProblem)(req, res, {
                                type: 'about:blank',
                                title: 'Задача не найдена',
                                status: 404,
                                detail: 'Not Found',
                            });
                        }
                        return;
                    }
                    try {
                        const finalizeResult = await (0, uploadFinalizer_1.finalizePendingUploads)({
                            req,
                            taskId: String(task._id),
                            attachments: Array.isArray(nextPayload.attachments)
                                ? nextPayload.attachments
                                : undefined,
                        });
                        if (Object.prototype.hasOwnProperty.call(nextPayload, 'attachments')) {
                            nextPayload.attachments =
                                finalizeResult.attachments;
                        }
                        task.attachments =
                            finalizeResult.attachments;
                    }
                    catch (error) {
                        await cleanupRequestUploads(req);
                        throw error;
                    }
                    const changedFields = Object.entries(nextPayload)
                        .filter(([, value]) => value !== undefined)
                        .map(([key]) => key);
                    await (0, service_1.writeLog)(`Обновлена задача ${req.params.id} пользователем ${req.user.id}/${req.user.username}`, 'info', {
                        taskId: req.params.id,
                        userId: req.user.id,
                        username: req.user.username,
                        changedFields,
                    });
                    res.json(task);
                    const docId = typeof task._id === 'object' && task._id !== null && 'toString' in task._id
                        ? task._id.toString()
                        : String(task._id ?? '');
                    if (docId) {
                        void this.broadcastTaskSnapshot(task, actorId, {
                            previous: previousTask,
                            action: 'обновлена',
                        }).catch((error) => {
                            console.error('Не удалось обновить сообщения задачи', error);
                        });
                    }
                },
            ];
            this.addTime = [
                validate_1.handleValidation,
                async (req, res) => {
                    const { minutes } = req.body;
                    const task = await this.service.addTime(req.params.id, minutes);
                    if (!task) {
                        (0, problem_1.sendProblem)(req, res, {
                            type: 'about:blank',
                            title: 'Задача не найдена',
                            status: 404,
                            detail: 'Not Found',
                        });
                        return;
                    }
                    await (0, service_1.writeLog)(`Время по задаче ${req.params.id} +${minutes} пользователем ${req.user.id}/${req.user.username}`);
                    res.json(task);
                },
            ];
            this.bulk = [
                validate_1.handleValidation,
                async (req, res) => {
                    const { ids, status } = req.body;
                    await this.service.bulk(ids, { status });
                    await (0, service_1.writeLog)(`Массовое изменение статусов пользователем ${req.user.id}/${req.user.username}`);
                    res.json({ status: 'ok' });
                },
            ];
            this.mentioned = async (req, res) => {
                const tasks = await this.service.mentioned(String(req.user.id));
                res.json(tasks);
            };
            this.transportOptions = async (_req, res) => {
                const positions = await CollectionItem_1.CollectionItem.find({
                    type: 'positions',
                    name: { $regex: /^водитель$/i },
                })
                    .select({ _id: 1 })
                    .lean();
                const positionIds = positions
                    .map((item) => (item?._id ? String(item._id) : null))
                    .filter((id) => typeof id === 'string' && id.length > 0);
                let drivers = [];
                if (positionIds.length > 0) {
                    drivers = await model_1.User.find({ positionId: { $in: positionIds } })
                        .select({ telegram_id: 1, name: 1, username: 1 })
                        .sort({ name: 1, telegram_id: 1 })
                        .lean();
                }
                const vehicles = await fleet_1.FleetVehicle.find()
                    .select({ name: 1, registrationNumber: 1, transportType: 1 })
                    .sort({ name: 1 })
                    .lean();
                res.json({
                    drivers: drivers.map((driver) => ({
                        id: driver.telegram_id,
                        name: (typeof driver.name === 'string' && driver.name.trim().length > 0
                            ? driver.name.trim()
                            : driver.username) || String(driver.telegram_id),
                        username: driver.username || null,
                    })),
                    vehicles: vehicles.map((vehicle) => ({
                        id: String(vehicle._id),
                        name: vehicle.name,
                        registrationNumber: vehicle.registrationNumber,
                        transportType: typeof vehicle.transportType === 'string' && vehicle.transportType.trim().length > 0
                            ? vehicle.transportType
                            : 'Легковой',
                    })),
                });
            };
            this.executors = async (req, res) => {
                const kindParam = typeof req.query.kind === 'string' ? req.query.kind.trim() : '';
                if (kindParam === 'request') {
                    const admins = await model_1.User.find({})
                        .select({ telegram_id: 1, name: 1, username: 1, role: 1, access: 1 })
                        .lean();
                    const list = admins
                        .filter((candidate) => hasAdminAccess(candidate.role, candidate.access))
                        .map((candidate) => ({
                        telegram_id: candidate.telegram_id,
                        name: candidate.name,
                        username: candidate.username,
                        telegram_username: candidate.username ?? null,
                    }));
                    res.json(list);
                    return;
                }
                res.json([]);
            };
            this.summary = async (req, res) => {
                const filters = this.normalizeReportFilters(req.query);
                res.json(await this.service.summary(filters));
            };
            this.chart = async (req, res) => {
                const filters = this.normalizeReportFilters(req.query);
                res.json(await this.service.chart(filters));
            };
            this.remove = async (req, res) => {
                const existing = await model_1.Task.findById(req.params.id);
                const plain = existing
                    ? (typeof existing.toObject === 'function'
                        ? existing.toObject()
                        : existing)
                    : null;
                if (!plain) {
                    (0, problem_1.sendProblem)(req, res, {
                        type: 'about:blank',
                        title: 'Задача не найдена',
                        status: 404,
                        detail: 'Not Found',
                    });
                    return;
                }
                const topicId = this.normalizeTopicId(plain.telegram_topic_id);
                const groupChatId = resolveGroupChatId();
                const normalizedGroupChatId = this.normalizeChatId(groupChatId);
                const photosChatId = this.normalizeChatId(plain.telegram_photos_chat_id);
                const photosTopicId = this.normalizeTopicId(plain.telegram_photos_topic_id);
                const photosMessageId = this.toMessageId(plain.telegram_photos_message_id);
                const messageTargets = new Map();
                const registerMessage = (messageId, expectedTopic, actualTopic) => {
                    if (typeof messageId !== 'number')
                        return;
                    if (!messageTargets.has(messageId)) {
                        messageTargets.set(messageId, {
                            expected: expectedTopic,
                            actual: actualTopic,
                        });
                    }
                };
                registerMessage(this.toMessageId(plain.telegram_message_id), topicId, topicId);
                registerMessage(this.toMessageId(plain.telegram_history_message_id), topicId, topicId);
                registerMessage(this.toMessageId(plain.telegram_status_message_id), topicId, topicId);
                registerMessage(this.toMessageId(plain.telegram_summary_message_id), topicId, topicId);
                registerMessage(this.toMessageId(plain.telegram_comment_message_id), topicId, topicId);
                const cleanupMeta = plain.telegram_message_cleanup;
                if (cleanupMeta && typeof cleanupMeta === 'object') {
                    const cleanupMessageId = this.toMessageId(cleanupMeta.message_id);
                    const cleanupTopicId = this.normalizeTopicId(cleanupMeta.topic_id);
                    const attemptedTopicId = this.normalizeTopicId(cleanupMeta.attempted_topic_id);
                    registerMessage(cleanupMessageId, cleanupTopicId, attemptedTopicId);
                    const newMessageId = this.toMessageId(cleanupMeta.new_message_id);
                    registerMessage(newMessageId, cleanupTopicId, attemptedTopicId);
                }
                const previewIds = this.normalizeMessageIdList(plain.telegram_preview_message_ids);
                const attachmentIds = this.normalizeMessageIdList(plain.telegram_attachments_message_ids);
                const directMessages = this.normalizeDirectMessages(plain.telegram_dm_message_ids);
                const attachmentsChatValue = photosChatId ?? groupChatId ?? normalizedGroupChatId;
                const normalizedAttachmentsChatId = this.normalizeChatId(attachmentsChatValue);
                const uniquePreviewIds = Array.from(new Set(previewIds));
                const uniqueAttachmentIds = Array.from(new Set(attachmentIds));
                if (normalizedAttachmentsChatId) {
                    if (uniquePreviewIds.length) {
                        await this.deleteAttachmentMessages(normalizedAttachmentsChatId, uniquePreviewIds);
                    }
                    if (uniqueAttachmentIds.length) {
                        await this.deleteAttachmentMessages(normalizedAttachmentsChatId, uniqueAttachmentIds);
                    }
                }
                if (groupChatId) {
                    for (const [messageId, meta] of messageTargets.entries()) {
                        await this.deleteTaskMessageSafely(groupChatId, messageId, meta.expected, meta.actual);
                    }
                }
                if (photosMessageId && normalizedAttachmentsChatId) {
                    await this.deleteTaskMessageSafely(normalizedAttachmentsChatId, photosMessageId, photosTopicId, photosTopicId);
                }
                await this.deleteDirectMessages(directMessages);
                const actorId = typeof req.user?.id === 'number' && Number.isFinite(req.user.id)
                    ? req.user.id
                    : undefined;
                const task = await this.service.remove(req.params.id, actorId);
                if (!task) {
                    (0, problem_1.sendProblem)(req, res, {
                        type: 'about:blank',
                        title: 'Задача не найдена',
                        status: 404,
                        detail: 'Not Found',
                    });
                    return;
                }
                await (0, service_1.writeLog)(`Удалена задача ${req.params.id} пользователем ${req.user.id}/${req.user.username}`);
                res.sendStatus(204);
            };
        }
        collectNotificationTargets(task, creatorId) {
            const recipients = new Set();
            const add = (value) => {
                const num = Number(value);
                if (!Number.isNaN(num) && Number.isFinite(num) && num !== 0)
                    recipients.add(num);
            };
            add(task.assigned_user_id);
            if (Array.isArray(task.assignees))
                task.assignees.forEach(add);
            add(task.controller_user_id);
            if (Array.isArray(task.controllers))
                task.controllers.forEach(add);
            add(task.created_by);
            if (creatorId !== undefined)
                add(creatorId);
            return recipients;
        }
        collectAssignees(task) {
            const recipients = new Set();
            const add = (value) => {
                if (!value) {
                    return;
                }
                if (typeof value === 'object') {
                    const record = value;
                    const isBotFlag = record.is_bot === true ||
                        (typeof record.is_bot === 'string' &&
                            record.is_bot.trim().toLowerCase() === 'true');
                    if (isBotFlag) {
                        return;
                    }
                    if ('telegram_id' in record) {
                        add(record.telegram_id);
                    }
                    if ('user_id' in record) {
                        add(record.user_id);
                    }
                    if ('id' in record) {
                        add(record.id);
                    }
                    return;
                }
                const num = Number(value);
                if (!Number.isNaN(num) && Number.isFinite(num) && num !== 0) {
                    recipients.add(num);
                }
            };
            add(task.assigned_user_id);
            if (task && typeof task === 'object') {
                const record = task;
                if (record.assigned_user && typeof record.assigned_user === 'object') {
                    const assignedRecord = record.assigned_user;
                    if ('telegram_id' in assignedRecord) {
                        add(assignedRecord.telegram_id);
                    }
                    else if ('id' in assignedRecord) {
                        add(assignedRecord.id);
                    }
                }
            }
            if (Array.isArray(task.assignees))
                task.assignees.forEach(add);
            return recipients;
        }
        isBotRecipientError(error) {
            if (!error || typeof error !== 'object') {
                return false;
            }
            const response = error.response;
            if (!response || response.error_code !== 403) {
                return false;
            }
            const description = typeof response.description === 'string' ? response.description : '';
            return description.toLowerCase().includes("bots can't send messages to bots");
        }
        async markUserAsBot(userId) {
            if (!Number.isFinite(userId)) {
                return;
            }
            try {
                await model_1.User.updateOne({ telegram_id: { $eq: userId } }, { $set: { is_bot: true } }).exec();
            }
            catch (error) {
                console.error(`Не удалось отметить пользователя ${userId} как бота`, error);
            }
        }
        async resolveAdminExecutors(values) {
            const normalized = Array.from(new Set(values
                .map((value) => Number(value))
                .filter((id) => Number.isFinite(id) && id > 0)));
            if (!normalized.length) {
                return [];
            }
            const admins = await model_1.User.find({
                telegram_id: { $in: normalized },
            })
                .select({ telegram_id: 1, role: 1, access: 1 })
                .lean();
            const allowed = admins
                .filter((candidate) => {
                if (!candidate)
                    return false;
                return hasAdminAccess(candidate.role, candidate.access);
            })
                .map((candidate) => Number(candidate.telegram_id))
                .filter((id) => Number.isFinite(id));
            return Array.from(new Set(allowed));
        }
        async resolvePhotoInputWithCache(url, cache) {
            if (!url)
                return url;
            if (!cache.has(url)) {
                const info = await this.resolveLocalPhotoInfo(url);
                const prepared = info ? await this.ensurePhotoWithinLimit(info) : info;
                cache.set(url, prepared);
            }
            let info = cache.get(url);
            if (!info) {
                return url;
            }
            info = await this.ensurePhotoWithinLimit(info);
            cache.set(url, info);
            try {
                const stream = (0, node_fs_1.createReadStream)(info.absolutePath);
                await new Promise((resolve, reject) => {
                    const handleOpen = () => {
                        stream.off('error', handleError);
                        resolve();
                    };
                    const handleError = (streamError) => {
                        stream.off('open', handleOpen);
                        reject(streamError);
                    };
                    stream.once('open', handleOpen);
                    stream.once('error', handleError);
                });
                const descriptor = {
                    source: stream,
                    filename: info.filename,
                    ...(info.contentType ? { contentType: info.contentType } : {}),
                };
                return descriptor;
            }
            catch (error) {
                if (error?.code !== 'ENOENT') {
                    console.error(`Не удалось открыть файл ${info.absolutePath} для отправки в Telegram`, error);
                }
                cache.set(url, null);
                return url;
            }
        }
        normalizeInlineImages(inline) {
            if (!inline?.length)
                return [];
            const result = [];
            inline.forEach((image) => {
                if (!image?.url)
                    return;
                const absolute = toAbsoluteAttachmentUrl(image.url);
                if (!absolute)
                    return;
                const hasInlineParam = /[?&]mode=inline(?:&|$)/.test(absolute);
                const url = hasInlineParam
                    ? absolute
                    : `${absolute}${absolute.includes('?') ? '&' : '?'}mode=inline`;
                const caption = image.alt && image.alt.trim() ? image.alt.trim() : undefined;
                const payload = { kind: 'image', url };
                if (caption) {
                    payload.caption = caption;
                }
                result.push(payload);
            });
            return result;
        }
        collectSendableAttachments(task, inline) {
            const previewPool = [];
            const extras = [];
            const collageCandidates = [];
            const extrasSeen = new Set();
            const registerExtra = (attachment) => {
                const key = `${attachment.kind}:${attachment.url}`;
                if (extrasSeen.has(key)) {
                    return;
                }
                extrasSeen.add(key);
                extras.push(attachment);
            };
            const registerImage = (image) => {
                previewPool.push(image);
                registerExtra(image);
                if (this.extractLocalFileId(image.url)) {
                    collageCandidates.push(image);
                }
            };
            this.normalizeInlineImages(inline).forEach(registerImage);
            if (Array.isArray(task.attachments) && task.attachments.length > 0) {
                task.attachments.forEach((attachment) => {
                    if (!attachment || typeof attachment.url !== 'string')
                        return;
                    const url = attachment.url.trim();
                    if (!url)
                        return;
                    if (YOUTUBE_URL_REGEXP.test(url)) {
                        const title = typeof attachment.name === 'string' && attachment.name.trim()
                            ? attachment.name.trim()
                            : undefined;
                        registerExtra({ kind: 'youtube', url, title });
                        return;
                    }
                    const type = typeof attachment.type === 'string'
                        ? attachment.type.trim().toLowerCase()
                        : '';
                    if (!type.startsWith('image/'))
                        return;
                    const absolute = toAbsoluteAttachmentUrl(url);
                    if (!absolute)
                        return;
                    const [mimeType] = type.split(';', 1);
                    const name = typeof attachment.name === 'string' && attachment.name.trim()
                        ? attachment.name.trim()
                        : undefined;
                    const size = typeof attachment.size === 'number' && Number.isFinite(attachment.size)
                        ? attachment.size
                        : undefined;
                    if (mimeType && SUPPORTED_PHOTO_MIME_TYPES.has(mimeType)) {
                        if (size !== undefined && size > MAX_PHOTO_SIZE_BYTES) {
                            const localId = this.extractLocalFileId(absolute);
                            if (!localId) {
                                registerExtra({
                                    kind: 'unsupported-image',
                                    url: absolute,
                                    mimeType,
                                    name,
                                    size,
                                });
                                return;
                            }
                            registerImage({ kind: 'image', url: absolute });
                            return;
                        }
                        registerImage({ kind: 'image', url: absolute });
                        return;
                    }
                    registerExtra({
                        kind: 'unsupported-image',
                        url: absolute,
                        mimeType,
                        name,
                        ...(size !== undefined ? { size } : {}),
                    });
                });
            }
            const previewImage = previewPool.length ? previewPool[0] : null;
            return {
                previewImage,
                extras,
                collageCandidates,
            };
        }
        async sendTaskMessageWithPreview(chat, message, _sections, media, keyboard, topicId, options) {
            const skipAlbum = options?.skipAlbum === true;
            const cache = new Map();
            const keyboardMarkup = this.extractKeyboardMarkup(keyboard);
            const preview = media.previewImage;
            const previewUrl = preview?.url;
            const albumCandidates = [];
            const seenAlbumUrls = new Set();
            if (!skipAlbum && preview && previewUrl && !seenAlbumUrls.has(previewUrl)) {
                albumCandidates.push(preview);
                seenAlbumUrls.add(previewUrl);
            }
            media.extras.forEach((attachment) => {
                if (skipAlbum)
                    return;
                if (attachment.kind !== 'image')
                    return;
                if (!attachment.url || seenAlbumUrls.has(attachment.url))
                    return;
                albumCandidates.push(attachment);
                seenAlbumUrls.add(attachment.url);
            });
            const baseMessageOptions = {
                parse_mode: 'MarkdownV2',
                link_preview_options: { is_disabled: true },
                ...(keyboardMarkup ? { reply_markup: keyboardMarkup } : {}),
            };
            if (typeof topicId === 'number') {
                baseMessageOptions.message_thread_id = topicId;
            }
            const messageChunks = splitMessageForTelegramLimit(message, TELEGRAM_MESSAGE_LIMIT);
            const [primaryMessage, ...continuationChunks] = messageChunks.length > 0 ? messageChunks : [message];
            const response = await bot_1.bot.telegram.sendMessage(chat, primaryMessage, baseMessageOptions);
            const mainMessageId = response?.message_id;
            const supplementaryMessageIds = [];
            const sendSupplementaryChunk = async (chunk) => {
                if (!chunk || !chunk.trim()) {
                    return;
                }
                try {
                    const extraOptions = {
                        parse_mode: 'MarkdownV2',
                        link_preview_options: { is_disabled: true },
                    };
                    if (typeof topicId === 'number') {
                        extraOptions.message_thread_id = topicId;
                    }
                    if (typeof mainMessageId === 'number') {
                        extraOptions.reply_parameters = {
                            message_id: mainMessageId,
                            allow_sending_without_reply: true,
                        };
                    }
                    const extraMessage = await bot_1.bot.telegram.sendMessage(chat, chunk, extraOptions);
                    if (extraMessage?.message_id) {
                        supplementaryMessageIds.push(extraMessage.message_id);
                    }
                }
                catch (error) {
                    console.error('Не удалось отправить дополнительный текст задачи', error);
                }
            };
            if (continuationChunks.length) {
                for (const chunk of continuationChunks) {
                    await sendSupplementaryChunk(chunk);
                }
            }
            const albumMessageIds = [];
            const consumedAlbumUrls = [];
            const albumCaption = (0, mdEscape_1.default)('Фото к задаче');
            const mediaReplyParameters = typeof mainMessageId === 'number'
                ? {
                    reply_parameters: {
                        message_id: mainMessageId,
                        allow_sending_without_reply: true,
                    },
                }
                : {};
            if (!skipAlbum && albumCandidates.length > 1) {
                try {
                    const mediaGroupOptions = {
                        ...(typeof topicId === 'number' ? { message_thread_id: topicId } : {}),
                        ...mediaReplyParameters,
                    };
                    const selected = albumCandidates.slice(0, 10);
                    consumedAlbumUrls.push(...selected.map((item) => item.url));
                    const mediaGroup = await Promise.all(selected.map(async (item, index) => {
                        const descriptor = {
                            type: 'photo',
                            media: await this.resolvePhotoInputWithCache(item.url, cache),
                        };
                        const captionValue = index === 0 ? albumCaption : item.caption ?? undefined;
                        if (captionValue) {
                            descriptor.caption =
                                index === 0
                                    ? captionValue
                                    : (0, mdEscape_1.default)(captionValue);
                            descriptor.parse_mode = 'MarkdownV2';
                        }
                        return descriptor;
                    }));
                    const mediaResponse = await bot_1.bot.telegram.sendMediaGroup(chat, mediaGroup, mediaGroupOptions);
                    if (Array.isArray(mediaResponse) && mediaResponse.length) {
                        mediaResponse.forEach((entry) => {
                            if (typeof entry?.message_id === 'number') {
                                albumMessageIds.push(entry.message_id);
                            }
                        });
                    }
                }
                catch (error) {
                    console.error('Не удалось отправить альбом задачи', error);
                }
            }
            else if (!skipAlbum && previewUrl) {
                try {
                    const photoOptions = {
                        ...(typeof topicId === 'number' ? { message_thread_id: topicId } : {}),
                        ...mediaReplyParameters,
                        caption: albumCaption,
                        parse_mode: 'MarkdownV2',
                    };
                    const photo = await this.resolvePhotoInputWithCache(previewUrl, cache);
                    const photoResponse = await bot_1.bot.telegram.sendPhoto(chat, photo, photoOptions);
                    if (photoResponse?.message_id) {
                        albumMessageIds.push(photoResponse.message_id);
                    }
                    consumedAlbumUrls.push(previewUrl);
                }
                catch (error) {
                    console.error('Не удалось отправить задачу с изображением превью', error);
                }
            }
            const previewMessageIds = [
                ...albumMessageIds,
                ...supplementaryMessageIds,
            ];
            return {
                messageId: mainMessageId,
                usedPreview: albumMessageIds.length > 0,
                cache,
                previewSourceUrls: consumedAlbumUrls.length ? consumedAlbumUrls : undefined,
                previewMessageIds: previewMessageIds.length ? previewMessageIds : undefined,
                consumedAttachmentUrls: consumedAlbumUrls,
            };
        }
        async ensurePhotoWithinLimit(info) {
            try {
                let current = info;
                let currentSize = current.size;
                if (currentSize === undefined) {
                    try {
                        const fileStat = await (0, promises_1.stat)(current.absolutePath);
                        currentSize = fileStat.size;
                        current = { ...current, size: currentSize };
                    }
                    catch (error) {
                        console.error('Не удалось определить размер изображения для Telegram', current.absolutePath, error);
                    }
                }
                if (currentSize !== undefined && currentSize <= MAX_PHOTO_SIZE_BYTES) {
                    return current;
                }
                const compressed = await this.createCompressedPhoto(current);
                return compressed ?? current;
            }
            catch (error) {
                console.error('Не удалось подготовить изображение для Telegram', info.absolutePath, error);
                return info;
            }
        }
        async createCompressedPhoto(info) {
            try {
                const metadata = await (0, sharp_1.default)(info.absolutePath).metadata();
                const baseWidth = metadata.width ?? null;
                const hasAlpha = metadata.hasAlpha === true;
                let width = baseWidth ?? null;
                let quality = 90;
                let buffer = null;
                for (let attempt = 0; attempt < 8; attempt += 1) {
                    let pipeline = (0, sharp_1.default)(info.absolutePath);
                    if (width && baseWidth && width < baseWidth) {
                        pipeline = pipeline.resize({
                            width,
                            fit: 'inside',
                            withoutEnlargement: true,
                        });
                    }
                    if (hasAlpha) {
                        pipeline = pipeline.flatten({ background: '#ffffff' });
                    }
                    pipeline = pipeline.jpeg({ quality, progressive: true });
                    buffer = await pipeline.toBuffer();
                    if (buffer.length <= MAX_PHOTO_SIZE_BYTES) {
                        break;
                    }
                    if (quality > 45) {
                        quality = Math.max(40, quality - 15);
                        continue;
                    }
                    if (width && width > 640) {
                        width = Math.max(640, Math.floor(width * 0.85));
                        continue;
                    }
                    if (width && width > 320) {
                        width = Math.max(320, Math.floor(width * 0.8));
                        continue;
                    }
                    break;
                }
                if (!buffer || buffer.length > MAX_PHOTO_SIZE_BYTES) {
                    return null;
                }
                const cacheDir = node_path_1.default.join(node_os_1.default.tmpdir(), 'erm-telegram-images');
                await (0, promises_1.mkdir)(cacheDir, { recursive: true });
                const tempName = `${(0, node_crypto_1.randomBytes)(12).toString('hex')}.jpg`;
                const outputPath = node_path_1.default.join(cacheDir, tempName);
                await (0, promises_1.writeFile)(outputPath, buffer);
                const finalName = `${node_path_1.default.parse(info.filename).name}-compressed.jpg`;
                return {
                    absolutePath: outputPath,
                    filename: finalName,
                    contentType: 'image/jpeg',
                    size: buffer.length,
                };
            }
            catch (error) {
                console.error('Не удалось сжать изображение для Telegram', info.absolutePath, error);
                return null;
            }
        }
        extractKeyboardMarkup(keyboard) {
            if (!keyboard || typeof keyboard !== 'object') {
                return undefined;
            }
            const candidate = keyboard;
            if (candidate.reply_markup && typeof candidate.reply_markup === 'object') {
                return candidate.reply_markup;
            }
            if (Array.isArray(candidate.inline_keyboard)) {
                return {
                    inline_keyboard: candidate.inline_keyboard,
                };
            }
            return undefined;
        }
        async updateTaskAlbumKeyboard(chatId, messageId, taskId, status, kind, albumLink) {
            try {
                const editMarkup = typeof bot_1.bot?.telegram?.editMessageReplyMarkup === 'function'
                    ? bot_1.bot.telegram.editMessageReplyMarkup.bind(bot_1.bot.telegram)
                    : null;
                if (!editMarkup) {
                    return;
                }
                const extras = {
                    ...(albumLink ? { albumLink } : {}),
                    showCommentButton: true,
                };
                const markup = (0, taskButtons_1.taskStatusInlineMarkup)(taskId, status, { kind }, extras);
                await editMarkup(chatId, messageId, undefined, markup);
            }
            catch (error) {
                if (!this.isMessageNotModifiedError(error)) {
                    console.error('Не удалось обновить клавиатуру задачи с кнопкой альбома', error);
                }
            }
        }
        extractLocalFileId(url) {
            if (!url)
                return null;
            try {
                const parsed = new URL(url, config_1.appUrl);
                if (baseAppHost && parsed.host && parsed.host !== baseAppHost) {
                    return null;
                }
                const match = FILE_ID_REGEXP.exec(parsed.pathname);
                return match ? match[1] : null;
            }
            catch {
                const normalized = url.startsWith('/') ? url : `/${url}`;
                const match = FILE_ID_REGEXP.exec(normalized);
                return match ? match[1] : null;
            }
        }
        extractPhotoErrorCode(error) {
            if (!error || typeof error !== 'object') {
                return null;
            }
            const { response, description, message, cause, } = error;
            const candidates = new Set();
            if (typeof response?.description === 'string') {
                candidates.add(response.description);
            }
            if (typeof description === 'string') {
                candidates.add(description);
            }
            if (typeof message === 'string') {
                candidates.add(message);
            }
            if (error instanceof Error && typeof error.message === 'string') {
                candidates.add(error.message);
            }
            const causeDescription = cause && typeof cause === 'object'
                ? cause.description
                : undefined;
            if (typeof causeDescription === 'string') {
                candidates.add(causeDescription);
            }
            const causeMessage = cause && typeof cause === 'object'
                ? cause.message
                : undefined;
            if (typeof causeMessage === 'string') {
                candidates.add(causeMessage);
            }
            for (const candidate of candidates) {
                for (const pattern of this.botApiPhotoErrorPatterns) {
                    const match = candidate.match(pattern);
                    if (match && match[0]) {
                        return match[0];
                    }
                }
            }
            return null;
        }
        isImageProcessFailedError(error) {
            return this.extractPhotoErrorCode(error) !== null;
        }
        isCaptionTooLongError(error) {
            if (!error || typeof error !== 'object')
                return false;
            const { description, message } = error;
            const descriptionText = typeof description === 'string' ? description.toLowerCase() : '';
            const messageText = typeof message === 'string' ? message.toLowerCase() : '';
            return (descriptionText.includes('caption is too long') ||
                messageText.includes('caption is too long'));
        }
        isMediaMessageTypeError(error) {
            if (!error || typeof error !== 'object')
                return false;
            const { description, message } = error;
            const descriptionText = typeof description === 'string' ? description.toLowerCase() : '';
            const messageText = typeof message === 'string' ? message.toLowerCase() : '';
            return (descriptionText.includes('message is not a media message') ||
                messageText.includes('message is not a media message'));
        }
        async resolveLocalPhotoInfo(url) {
            const fileId = this.extractLocalFileId(url);
            if (!fileId)
                return null;
            try {
                const fileModel = model_1.File;
                if (!fileModel || typeof fileModel.findById !== 'function') {
                    return null;
                }
                const query = fileModel.findById(fileId);
                const record = query && typeof query.lean === 'function'
                    ? await query.lean()
                    : (await query);
                if (!record || typeof record.path !== 'string' || !record.path.trim()) {
                    return null;
                }
                const normalizedPath = record.path.trim();
                const target = node_path_1.default.resolve(uploadsAbsoluteDir, normalizedPath);
                const relative = node_path_1.default.relative(uploadsAbsoluteDir, target);
                if (!relative ||
                    relative.startsWith('..') ||
                    node_path_1.default.isAbsolute(relative)) {
                    return null;
                }
                await (0, promises_1.access)(target);
                const filenameSource = typeof record.name === 'string' && record.name.trim()
                    ? record.name.trim()
                    : normalizedPath;
                const filename = node_path_1.default.basename(filenameSource);
                const contentType = typeof record.type === 'string' && record.type.trim()
                    ? record.type.trim()
                    : undefined;
                let size = typeof record.size === 'number' && Number.isFinite(record.size)
                    ? record.size
                    : undefined;
                if (size === undefined) {
                    try {
                        const fileStat = await (0, promises_1.stat)(target);
                        size = fileStat.size;
                    }
                    catch (error) {
                        console.error('Не удалось получить размер файла вложения', target, error);
                    }
                }
                return { absolutePath: target, filename, contentType, size };
            }
            catch (error) {
                if (error?.code !== 'ENOENT') {
                    console.error(`Не удалось подготовить файл ${url} для отправки в Telegram`, error);
                }
                return null;
            }
        }
        areNormalizedAttachmentsEqual(previous, next) {
            if (previous.length !== next.length)
                return false;
            return previous.every((item, index) => {
                const candidate = next[index];
                if (!candidate)
                    return false;
                if (item.kind !== candidate.kind)
                    return false;
                if (item.url !== candidate.url)
                    return false;
                if (item.kind === 'youtube' && candidate.kind === 'youtube') {
                    return item.title === candidate.title;
                }
                if (item.kind === 'image' && candidate.kind === 'image') {
                    return (item.caption ?? '') === (candidate.caption ?? '');
                }
                return true;
            });
        }
        areMessageIdListsEqual(left, right) {
            if (left.length !== right.length)
                return false;
            return left.every((value, index) => right[index] === value);
        }
        async deleteAttachmentMessages(chat, messageIds) {
            if (!messageIds.length)
                return;
            await Promise.all(messageIds.map(async (messageId) => {
                if (!Number.isFinite(messageId))
                    return;
                try {
                    await bot_1.bot.telegram.deleteMessage(chat, messageId);
                }
                catch (error) {
                    if (this.isMessageMissingOnDeleteError(error)) {
                        console.info(`Сообщение вложения ${messageId} уже удалено в Telegram`);
                        return;
                    }
                    console.error(`Не удалось удалить сообщение вложений ${messageId}`, error);
                }
            }));
        }
        normalizeDirectMessages(value) {
            if (!Array.isArray(value))
                return [];
            return value
                .map((entry) => {
                if (!entry || typeof entry !== 'object') {
                    return null;
                }
                const record = entry;
                const userId = Number(record.user_id);
                const messageId = Number(record.message_id);
                if (!Number.isFinite(userId) || !Number.isFinite(messageId)) {
                    return null;
                }
                return { user_id: userId, message_id: messageId };
            })
                .filter((entry) => entry !== null);
        }
        toMessageId(value) {
            if (typeof value === 'number' && Number.isFinite(value)) {
                return value;
            }
            if (typeof value === 'string') {
                const parsed = Number(value.trim());
                if (Number.isFinite(parsed)) {
                    return parsed;
                }
            }
            return undefined;
        }
        normalizeMessageIdList(value) {
            if (!Array.isArray(value))
                return [];
            return value
                .map((item) => this.toMessageId(item))
                .filter((item) => typeof item === 'number');
        }
        async deleteDirectMessages(entries) {
            if (!entries.length)
                return;
            await Promise.all(entries.map(async ({ user_id: userId, message_id: messageId }) => {
                if (!Number.isFinite(userId) || !Number.isFinite(messageId))
                    return;
                try {
                    await bot_1.bot.telegram.deleteMessage(userId, messageId);
                }
                catch (error) {
                    if (this.isMessageMissingOnDeleteError(error)) {
                        console.info(`Личное сообщение задачи ${messageId} у пользователя ${userId} уже удалено в Telegram`);
                        return;
                    }
                    console.error(`Не удалось удалить личное сообщение задачи ${messageId} у пользователя ${userId}`, error);
                }
            }));
        }
        normalizeChatId(value) {
            if (typeof value === 'number' && Number.isFinite(value)) {
                return value.toString();
            }
            if (typeof value === 'string') {
                const trimmed = value.trim();
                return trimmed ? trimmed : undefined;
            }
            return undefined;
        }
        normalizeTopicId(value) {
            if (typeof value === 'number') {
                return Number.isFinite(value) ? value : undefined;
            }
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (!trimmed) {
                    return undefined;
                }
                const parsed = Number.parseInt(trimmed, 10);
                return Number.isFinite(parsed) ? parsed : undefined;
            }
            return undefined;
        }
        areTopicsEqual(left, right) {
            if (typeof left === 'number' && typeof right === 'number') {
                return left === right;
            }
            return typeof left === 'undefined' && typeof right === 'undefined';
        }
        areChatsEqual(left, right) {
            return this.normalizeChatId(left) === this.normalizeChatId(right);
        }
        buildPhotoAlbumIntro(task, options) {
            const title = typeof task.title === 'string' ? task.title.trim() : '';
            const text = title
                ? `*${(0, mdEscape_1.default)(title)}*`
                : 'Фото по задаче';
            const messageLink = options.messageLink ?? null;
            const inlineKeyboard = messageLink
                ? [[{ text: 'Перейти к задаче', url: messageLink }]]
                : [];
            const replyMarkup = inlineKeyboard.length
                ? { inline_keyboard: inlineKeyboard }
                : undefined;
            const sendOptions = {
                parse_mode: 'MarkdownV2',
                link_preview_options: { is_disabled: true },
                ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
            };
            if (typeof options.topicId === 'number') {
                sendOptions.message_thread_id = options.topicId;
            }
            return { text, options: sendOptions };
        }
        async resolveTaskTopicId(task) {
            const direct = this.normalizeTopicId(task.telegram_topic_id);
            if (typeof direct === 'number') {
                return direct;
            }
            const type = typeof task.task_type === 'string' ? task.task_type.trim() : '';
            if (!type) {
                return undefined;
            }
            const topicId = await (0, taskTypeSettings_1.resolveTaskTypeTopicId)(type);
            if (typeof topicId === 'number') {
                task.telegram_topic_id = topicId;
                return topicId;
            }
            return undefined;
        }
        async deleteTaskMessageSafely(chat, messageId, expectedTopic, actualTopic) {
            if (!Number.isFinite(messageId)) {
                return false;
            }
            if (!this.areTopicsEqual(expectedTopic, actualTopic)) {
                console.warn('Пропускаем удаление сообщения задачи из другой темы', {
                    expectedTopic,
                    actualTopic,
                    messageId,
                });
                return false;
            }
            try {
                await bot_1.bot.telegram.deleteMessage(chat, messageId);
                return true;
            }
            catch (error) {
                if (this.isMessageMissingOnDeleteError(error)) {
                    console.info(`Сообщение ${messageId} задачи уже удалено в Telegram`);
                    return true;
                }
                console.error(`Не удалось удалить сообщение ${messageId} задачи в Telegram`, error);
                return false;
            }
        }
        async updateTaskTelegramFields(taskId, set, unset, guard) {
            const update = {};
            if (Object.keys(set).length) {
                update.$set = set;
            }
            if (Object.keys(unset).length) {
                update.$unset = unset;
            }
            if (!Object.keys(update).length) {
                return;
            }
            const filter = { _id: taskId };
            if (guard) {
                if (typeof guard.previous === 'number') {
                    filter[guard.field] = guard.previous;
                }
                else {
                    filter.$or = [
                        { [guard.field]: { $exists: false } },
                        { [guard.field]: null },
                    ];
                }
            }
            try {
                const result = await model_1.Task.updateOne(filter, update).exec();
                const matched = (typeof result === 'object' && result !== null && 'matchedCount' in result
                    ? Number(result.matchedCount)
                    : typeof result === 'object' && result !== null && 'n' in result
                        ? Number(result.n)
                        : 0) || 0;
                if (guard && matched === 0) {
                    console.warn('Не удалось сохранить telegram_message_id из-за изменения состояния задачи', { taskId });
                }
            }
            catch (error) {
                console.error('Не удалось сохранить обновлённые данные Telegram для задачи', error);
            }
        }
        async sendTaskAttachments(chat, attachments, topicId, replyTo, cache) {
            if (!attachments.length)
                return [];
            const sentMessageIds = [];
            const photoOptionsBase = () => {
                const options = {};
                if (typeof topicId === 'number') {
                    options.message_thread_id = topicId;
                }
                if (replyTo) {
                    options.reply_parameters = {
                        message_id: replyTo,
                        allow_sending_without_reply: true,
                    };
                }
                return options;
            };
            const messageOptionsBase = () => {
                const options = {
                    parse_mode: 'MarkdownV2',
                    link_preview_options: { is_disabled: true },
                };
                if (typeof topicId === 'number') {
                    options.message_thread_id = topicId;
                }
                if (replyTo) {
                    options.reply_parameters = {
                        message_id: replyTo,
                        allow_sending_without_reply: true,
                    };
                }
                return options;
            };
            const documentOptionsBase = () => {
                const options = {};
                if (typeof topicId === 'number') {
                    options.message_thread_id = topicId;
                }
                if (replyTo) {
                    options.reply_parameters = {
                        message_id: replyTo,
                        allow_sending_without_reply: true,
                    };
                }
                return options;
            };
            const localPhotoInfoCache = cache ?? new Map();
            const resolvePhotoInput = (url) => this.resolvePhotoInputWithCache(url, localPhotoInfoCache);
            const pendingImages = [];
            const mediaGroupOptionsBase = () => {
                const options = {};
                if (typeof topicId === 'number') {
                    options.message_thread_id = topicId;
                }
                if (replyTo) {
                    options.reply_parameters = {
                        message_id: replyTo,
                        allow_sending_without_reply: true,
                    };
                }
                return options;
            };
            const sendSingleImage = async (current) => {
                const caption = current.caption;
                const sendPhotoAttempt = async () => {
                    const options = photoOptionsBase();
                    if (caption) {
                        options.caption = (0, mdEscape_1.default)(caption);
                        options.parse_mode = 'MarkdownV2';
                    }
                    const media = await resolvePhotoInput(current.url);
                    const response = await bot_1.bot.telegram.sendPhoto(chat, media, options);
                    if (response?.message_id) {
                        sentMessageIds.push(response.message_id);
                    }
                };
                try {
                    await sendPhotoAttempt();
                    return;
                }
                catch (error) {
                    const photoErrorCode = this.extractPhotoErrorCode(error);
                    if (!photoErrorCode) {
                        throw error;
                    }
                    console.warn(`Telegram не смог обработать изображение (код: ${photoErrorCode}), отправляем как документ`, current.url, error);
                    const documentOptions = documentOptionsBase();
                    if (caption) {
                        documentOptions.caption = (0, mdEscape_1.default)(caption);
                        documentOptions.parse_mode = 'MarkdownV2';
                    }
                    const fallback = await resolvePhotoInput(current.url);
                    const response = await bot_1.bot.telegram.sendDocument(chat, fallback, documentOptions);
                    if (response?.message_id) {
                        sentMessageIds.push(response.message_id);
                    }
                }
            };
            const flushImages = async () => {
                while (pendingImages.length) {
                    if (pendingImages.length === 1) {
                        const current = pendingImages.shift();
                        if (!current)
                            continue;
                        await sendSingleImage(current);
                        continue;
                    }
                    const batch = pendingImages.splice(0, 10);
                    const mediaGroup = await Promise.all(batch.map(async (item) => {
                        const descriptor = {
                            type: 'photo',
                            media: await resolvePhotoInput(item.url),
                        };
                        if (item.caption) {
                            descriptor.caption = (0, mdEscape_1.default)(item.caption);
                            descriptor.parse_mode = 'MarkdownV2';
                        }
                        return descriptor;
                    }));
                    try {
                        const response = await bot_1.bot.telegram.sendMediaGroup(chat, mediaGroup, mediaGroupOptionsBase());
                        if (!Array.isArray(response) || response.length === 0) {
                            throw new Error('Telegram не вернул сообщения для медиа-группы');
                        }
                        response.forEach((message) => {
                            if (message?.message_id) {
                                sentMessageIds.push(message.message_id);
                            }
                        });
                    }
                    catch (error) {
                        console.warn('Не удалось отправить изображения медиа-группой, отправляем по одному', error);
                        for (const item of batch) {
                            await sendSingleImage(item);
                        }
                    }
                }
            };
            for (const attachment of attachments) {
                if (attachment.kind === 'image') {
                    pendingImages.push({ url: attachment.url, caption: attachment.caption });
                    continue;
                }
                await flushImages();
                if (attachment.kind === 'unsupported-image') {
                    try {
                        const response = await bot_1.bot.telegram.sendDocument(chat, await resolvePhotoInput(attachment.url), (() => {
                            const options = documentOptionsBase();
                            if (attachment.caption) {
                                options.caption = (0, mdEscape_1.default)(attachment.caption);
                                options.parse_mode = 'MarkdownV2';
                            }
                            return options;
                        })());
                        if (response?.message_id) {
                            sentMessageIds.push(response.message_id);
                        }
                    }
                    catch (error) {
                        console.error('Не удалось отправить неподдерживаемое изображение как документ', attachment.mimeType ?? 'unknown', attachment.name ?? attachment.url, error);
                    }
                    continue;
                }
                if (attachment.kind === 'youtube') {
                    const label = attachment.title ? attachment.title : 'YouTube';
                    const text = `▶️ [${(0, mdEscape_1.default)(label)}](${(0, mdEscape_1.default)(attachment.url)})`;
                    const response = await bot_1.bot.telegram.sendMessage(chat, text, messageOptionsBase());
                    if (response?.message_id) {
                        sentMessageIds.push(response.message_id);
                    }
                }
            }
            await flushImages();
            return sentMessageIds;
        }
        async syncAttachmentMessages(chat, previous, next, messageIds, topicId, replyTo, cacheOverride, previewMessageIds) {
            const normalizedMessageIds = messageIds.filter((value) => typeof value === 'number' && Number.isFinite(value));
            const previewIdSet = new Set((previewMessageIds ?? []).filter((value) => typeof value === 'number' && Number.isFinite(value)));
            const previewOnlyIds = normalizedMessageIds.filter((id) => previewIdSet.has(id));
            const nonPreviewIds = normalizedMessageIds.filter((id) => !previewIdSet.has(id));
            if (!next.length) {
                if (previewOnlyIds.length) {
                    await this.deleteAttachmentMessages(chat, previewOnlyIds);
                }
                return [];
            }
            const cache = cacheOverride ?? new Map();
            const result = [];
            if (!nonPreviewIds.length) {
                const extra = await this.sendTaskAttachments(chat, next, topicId, replyTo, cache);
                result.push(...extra);
                return result;
            }
            const limit = Math.min(next.length, nonPreviewIds.length);
            for (let index = 0; index < limit; index += 1) {
                const attachment = next[index];
                const messageId = nonPreviewIds[index];
                if (!Number.isFinite(messageId)) {
                    return null;
                }
                const previousAttachment = previous[index];
                if (previousAttachment && previousAttachment.kind !== attachment.kind) {
                    return null;
                }
                if (attachment.kind === 'image') {
                    const previousUrl = previousAttachment && previousAttachment.kind === 'image'
                        ? previousAttachment.url
                        : null;
                    const previousCaption = previousAttachment && previousAttachment.kind === 'image'
                        ? previousAttachment.caption ?? ''
                        : '';
                    const nextCaption = attachment.caption ?? '';
                    const urlChanged = previousUrl !== attachment.url;
                    const captionChanged = previousCaption !== nextCaption;
                    if (!urlChanged && !captionChanged) {
                        result.push(messageId);
                        continue;
                    }
                    try {
                        const media = {
                            type: 'photo',
                            media: await this.resolvePhotoInputWithCache(attachment.url, cache),
                        };
                        if (attachment.caption) {
                            media.caption = (0, mdEscape_1.default)(attachment.caption);
                            media.parse_mode = 'MarkdownV2';
                        }
                        else {
                            media.caption = '';
                        }
                        await bot_1.bot.telegram.editMessageMedia(chat, messageId, undefined, media);
                        result.push(messageId);
                    }
                    catch (error) {
                        if (this.isMessageNotModifiedError(error)) {
                            result.push(messageId);
                            continue;
                        }
                        console.error('Не удалось обновить изображение вложения', error);
                        return null;
                    }
                    continue;
                }
                if (attachment.kind === 'unsupported-image') {
                    const previousEntry = previousAttachment && previousAttachment.kind === 'unsupported-image'
                        ? previousAttachment
                        : null;
                    const previousUrl = previousEntry ? previousEntry.url : null;
                    const previousCaption = previousEntry?.caption ?? '';
                    const previousMime = previousEntry?.mimeType ?? '';
                    const previousName = previousEntry?.name ?? '';
                    const nextCaption = attachment.caption ?? '';
                    const nextMime = attachment.mimeType ?? '';
                    const nextName = attachment.name ?? '';
                    const urlChanged = previousUrl !== attachment.url;
                    const captionChanged = previousCaption !== nextCaption;
                    const metaChanged = previousMime !== nextMime || previousName !== nextName;
                    if (!urlChanged && !captionChanged && !metaChanged) {
                        result.push(messageId);
                        continue;
                    }
                    try {
                        const media = {
                            type: 'document',
                            media: await this.resolvePhotoInputWithCache(attachment.url, cache),
                        };
                        if (attachment.caption) {
                            media.caption = (0, mdEscape_1.default)(attachment.caption);
                            media.parse_mode = 'MarkdownV2';
                        }
                        else {
                            media.caption = '';
                        }
                        await bot_1.bot.telegram.editMessageMedia(chat, messageId, undefined, media);
                        result.push(messageId);
                    }
                    catch (error) {
                        if (this.isMessageNotModifiedError(error)) {
                            result.push(messageId);
                            continue;
                        }
                        console.error('Не удалось обновить вложение неподдерживаемого изображения', attachment.mimeType ?? 'unknown', attachment.name ?? attachment.url, error);
                        return null;
                    }
                    continue;
                }
                if (attachment.kind === 'youtube') {
                    const previousTitle = previousAttachment && previousAttachment.kind === 'youtube'
                        ? previousAttachment.title ?? ''
                        : '';
                    const previousUrl = previousAttachment && previousAttachment.kind === 'youtube'
                        ? previousAttachment.url
                        : '';
                    if (previousUrl === attachment.url &&
                        previousTitle === (attachment.title ?? '')) {
                        result.push(messageId);
                        continue;
                    }
                    try {
                        const label = attachment.title ? attachment.title : 'YouTube';
                        const text = `▶️ [${(0, mdEscape_1.default)(label)}](${(0, mdEscape_1.default)(attachment.url)})`;
                        await bot_1.bot.telegram.editMessageText(chat, messageId, undefined, text, {
                            parse_mode: 'MarkdownV2',
                            link_preview_options: { is_disabled: true },
                        });
                        result.push(messageId);
                    }
                    catch (error) {
                        console.error('Не удалось обновить ссылку на YouTube', error);
                        return null;
                    }
                    continue;
                }
                return null;
            }
            if (next.length < nonPreviewIds.length) {
                const redundant = nonPreviewIds.slice(next.length);
                await this.deleteAttachmentMessages(chat, redundant);
            }
            if (next.length > nonPreviewIds.length) {
                const extra = await this.sendTaskAttachments(chat, next.slice(nonPreviewIds.length), topicId, replyTo, cache);
                result.push(...extra);
            }
            return result;
        }
        isMessageNotModifiedError(error) {
            if (!error || typeof error !== 'object')
                return false;
            const record = error;
            const rawResponse = record.response;
            const response = rawResponse && typeof rawResponse === 'object'
                ? rawResponse
                : null;
            const descriptionRaw = (response?.description ??
                (typeof record.description === 'string' ? record.description : null)) ??
                null;
            const description = typeof descriptionRaw === 'string' ? descriptionRaw.toLowerCase() : '';
            return (response?.error_code === 400 &&
                description.includes('message is not modified'));
        }
        isMessageMissingOnEditError(error) {
            if (!error || typeof error !== 'object')
                return false;
            const record = error;
            const rawResponse = record.response;
            const response = rawResponse && typeof rawResponse === 'object'
                ? rawResponse
                : null;
            const errorCode = response?.error_code ??
                (typeof record.error_code === 'number' ? record.error_code : null);
            if (errorCode !== 400) {
                return false;
            }
            const descriptionRaw = (response?.description ??
                (typeof record.description === 'string' ? record.description : null)) ??
                null;
            if (typeof descriptionRaw !== 'string') {
                return false;
            }
            const normalized = descriptionRaw.toLowerCase();
            return (normalized.includes('message to edit not found') ||
                normalized.includes('message to edit not found in the chat') ||
                normalized.includes('message with the specified identifier not found'));
        }
        isMessageMissingOnDeleteError(error) {
            if (!error || typeof error !== 'object')
                return false;
            const record = error;
            const rawResponse = record.response;
            const response = rawResponse && typeof rawResponse === 'object'
                ? rawResponse
                : null;
            const errorCode = response?.error_code ??
                (typeof record.error_code === 'number' ? record.error_code : null);
            if (errorCode !== 400) {
                return false;
            }
            const descriptionRaw = (response?.description ??
                (typeof record.description === 'string' ? record.description : null)) ??
                null;
            if (typeof descriptionRaw !== 'string') {
                return false;
            }
            return descriptionRaw.toLowerCase().includes('message to delete not found');
        }
        async broadcastTaskSnapshot(task, actorId, options) {
            const docId = typeof task._id === 'object' && task._id !== null && 'toString' in task._id
                ? task._id.toString()
                : String(task._id ?? '');
            if (!docId)
                return;
            const plain = (typeof task.toObject === 'function'
                ? task.toObject()
                : task);
            const previousPlain = options?.previous ?? null;
            const action = options?.action ?? 'создана';
            const noteRaw = typeof options?.note === 'string' ? options.note.trim() : '';
            const dmNote = noteRaw || (action === 'обновлена' ? 'Задачу обновили' : '');
            const groupChatId = resolveGroupChatId();
            const normalizedGroupChatId = this.normalizeChatId(groupChatId);
            const photosTarget = await (0, taskTypeSettings_1.resolveTaskTypePhotosTarget)(plain.task_type);
            const configuredPhotosChatId = this.normalizeChatId(photosTarget?.chatId);
            const configuredPhotosTopicId = this.normalizeTopicId(photosTarget?.topicId);
            const previousPhotosChatId = this.normalizeChatId(previousPlain?.telegram_photos_chat_id);
            const previousPhotosTopicId = this.normalizeTopicId(previousPlain?.telegram_photos_topic_id);
            const previousPhotosMessageId = this.toMessageId(previousPlain?.telegram_photos_message_id);
            const previousCommentMessageId = this.toMessageId(previousPlain?.telegram_comment_message_id);
            const recipients = this.collectNotificationTargets(plain, actorId);
            let users = {};
            try {
                const usersRaw = await (0, queries_1.getUsersMap)(Array.from(recipients));
                users = Object.fromEntries(Object.entries(usersRaw).map(([key, value]) => {
                    const name = value.name ?? value.username ?? '';
                    const username = value.username ?? '';
                    const isBot = value?.is_bot === true;
                    return [Number(key), { name, username, isBot }];
                }));
            }
            catch (error) {
                console.error('Не удалось получить данные пользователей задачи', error);
            }
            const kind = detectTaskKind(plain);
            const keyboard = (0, taskButtons_1.default)(docId, typeof plain.status === 'string'
                ? plain.status
                : undefined, { kind }, { showCommentButton: true });
            const formatted = (0, formatTask_1.default)(plain, users);
            const message = formatted.text;
            const topicId = await this.resolveTaskTopicId(plain);
            const previousTopicId = this.normalizeTopicId(previousPlain?.telegram_topic_id);
            const normalizeMessageIds = (value) => Array.isArray(value)
                ? value
                    .map((item) => typeof item === 'number' && Number.isFinite(item) ? item : null)
                    .filter((item) => item !== null)
                : [];
            const taskAppLink = (0, taskLinks_1.buildTaskAppLink)(plain);
            let groupMessageId;
            let messageLink = null;
            let attachmentMessageIds = [];
            let previewMessageIds = [];
            let directMessages = [];
            let photosMessageId;
            let photosChatId;
            let photosTopicId;
            let albumLinkForKeyboard = null;
            let commentMessageId;
            if (groupChatId) {
                try {
                    if (previousPlain) {
                        const previousMessageId = typeof previousPlain.telegram_message_id === 'number'
                            ? previousPlain.telegram_message_id
                            : undefined;
                        const previousPreviewIds = normalizeMessageIds(previousPlain.telegram_preview_message_ids);
                        const previousAttachmentIds = normalizeMessageIds(previousPlain.telegram_attachments_message_ids);
                        const cleanupTargets = new Set();
                        if (typeof previousPlain.telegram_history_message_id === 'number') {
                            cleanupTargets.add(previousPlain.telegram_history_message_id);
                        }
                        if (typeof previousPlain.telegram_status_message_id === 'number') {
                            cleanupTargets.add(previousPlain.telegram_status_message_id);
                        }
                        if (typeof previousPlain.telegram_comment_message_id === 'number') {
                            cleanupTargets.add(previousPlain.telegram_comment_message_id);
                        }
                        if (previousMessageId) {
                            await this.deleteTaskMessageSafely(groupChatId, previousMessageId, previousTopicId, topicId);
                        }
                        if (previousPreviewIds.length) {
                            const previousAttachmentChatId = previousPhotosChatId ?? normalizedGroupChatId;
                            if (previousAttachmentChatId) {
                                await this.deleteAttachmentMessages(previousAttachmentChatId, previousPreviewIds);
                            }
                        }
                        if (previousAttachmentIds.length) {
                            const previousAttachmentChatId = previousPhotosChatId ?? normalizedGroupChatId;
                            if (previousAttachmentChatId) {
                                await this.deleteAttachmentMessages(previousAttachmentChatId, previousAttachmentIds);
                            }
                        }
                        for (const messageId of cleanupTargets) {
                            await this.deleteTaskMessageSafely(groupChatId, messageId, previousTopicId, topicId);
                        }
                        if (previousPhotosMessageId) {
                            const photosChat = previousPhotosChatId ?? normalizedGroupChatId;
                            if (photosChat) {
                                await this.deleteTaskMessageSafely(photosChat, previousPhotosMessageId, previousPhotosTopicId, previousPhotosTopicId);
                            }
                        }
                    }
                    const attachmentsChatValue = configuredPhotosChatId ?? groupChatId ?? normalizedGroupChatId;
                    const normalizedAttachmentsChatId = this.normalizeChatId(attachmentsChatValue);
                    const attachmentsTopicIdForSend = (() => {
                        if (typeof configuredPhotosTopicId === 'number') {
                            return configuredPhotosTopicId;
                        }
                        if (normalizedAttachmentsChatId &&
                            !this.areChatsEqual(normalizedAttachmentsChatId, normalizedGroupChatId)) {
                            return undefined;
                        }
                        return topicId;
                    })();
                    const useSeparatePhotosChat = Boolean(normalizedAttachmentsChatId &&
                        !this.areChatsEqual(normalizedAttachmentsChatId, normalizedGroupChatId));
                    const useSeparatePhotosTopic = typeof attachmentsTopicIdForSend === 'number' &&
                        !this.areTopicsEqual(attachmentsTopicIdForSend, topicId);
                    const shouldSendAttachmentsSeparately = Boolean(normalizedAttachmentsChatId &&
                        (useSeparatePhotosChat || useSeparatePhotosTopic));
                    const media = this.collectSendableAttachments(plain, formatted.inlineImages);
                    const sendResult = await this.sendTaskMessageWithPreview(groupChatId, message, formatted.sections, media, keyboard, topicId, { skipAlbum: shouldSendAttachmentsSeparately });
                    groupMessageId = sendResult.messageId;
                    previewMessageIds = sendResult.previewMessageIds ?? [];
                    messageLink = (0, messageLink_1.default)(groupChatId, groupMessageId, topicId);
                    if (!shouldSendAttachmentsSeparately &&
                        Array.isArray(sendResult.previewMessageIds) &&
                        sendResult.previewMessageIds.length > 0) {
                        const albumMessageId = sendResult.previewMessageIds[0];
                        if (typeof albumMessageId === 'number') {
                            albumLinkForKeyboard = (0, messageLink_1.default)(groupChatId, albumMessageId, topicId);
                        }
                    }
                    const consumedUrls = new Set((sendResult.consumedAttachmentUrls ?? []).filter((url) => Boolean(url)));
                    const extras = shouldSendAttachmentsSeparately
                        ? media.extras
                        : consumedUrls.size
                            ? media.extras.filter((attachment) => attachment.kind === 'image'
                                ? !consumedUrls.has(attachment.url)
                                : true)
                            : media.extras;
                    let albumIntroMessageId;
                    if (extras.length) {
                        const shouldSendAlbumIntro = shouldSendAttachmentsSeparately;
                        let albumMessageId;
                        if (shouldSendAlbumIntro && normalizedAttachmentsChatId) {
                            const intro = this.buildPhotoAlbumIntro(plain, {
                                messageLink,
                                appLink: taskAppLink ?? null,
                                topicId: attachmentsTopicIdForSend ?? undefined,
                            });
                            try {
                                const response = await bot_1.bot.telegram.sendMessage(normalizedAttachmentsChatId, intro.text, intro.options);
                                if (response?.message_id) {
                                    albumMessageId = response.message_id;
                                    albumIntroMessageId = response.message_id;
                                }
                            }
                            catch (error) {
                                console.error('Не удалось отправить описание альбома задачи', error);
                            }
                        }
                        const shouldReplyToGroup = Boolean(normalizedAttachmentsChatId &&
                            this.areChatsEqual(normalizedAttachmentsChatId, normalizedGroupChatId) &&
                            this.areTopicsEqual(attachmentsTopicIdForSend, topicId));
                        if (attachmentsChatValue) {
                            try {
                                const replyTo = albumMessageId
                                    ? albumMessageId
                                    : shouldReplyToGroup
                                        ? groupMessageId
                                        : undefined;
                                attachmentMessageIds = await this.sendTaskAttachments(attachmentsChatValue, extras, attachmentsTopicIdForSend, replyTo, sendResult.cache);
                                if (typeof albumMessageId === 'number' &&
                                    normalizedAttachmentsChatId) {
                                    photosMessageId = albumMessageId;
                                    photosChatId = normalizedAttachmentsChatId;
                                    photosTopicId =
                                        typeof attachmentsTopicIdForSend === 'number'
                                            ? attachmentsTopicIdForSend
                                            : undefined;
                                    albumLinkForKeyboard =
                                        (0, messageLink_1.default)(normalizedAttachmentsChatId, albumMessageId, attachmentsTopicIdForSend) ?? albumLinkForKeyboard;
                                }
                            }
                            catch (error) {
                                console.error('Не удалось отправить вложения задачи', error);
                            }
                        }
                    }
                    if (typeof albumIntroMessageId === 'number' &&
                        normalizedAttachmentsChatId) {
                        await (0, delay_1.default)(ALBUM_MESSAGE_DELAY_MS);
                    }
                    if (groupMessageId &&
                        groupChatId &&
                        docId &&
                        typeof docId === 'string') {
                        const currentStatus = typeof plain.status === 'string'
                            ? plain.status
                            : undefined;
                        await this.updateTaskAlbumKeyboard(groupChatId, groupMessageId, docId, currentStatus, kind, albumLinkForKeyboard);
                    }
                }
                catch (error) {
                    console.error('Не удалось отправить уведомление в группу', error);
                }
            }
            if (groupChatId) {
                const baseMessageId = typeof groupMessageId === 'number'
                    ? groupMessageId
                    : this.toMessageId(plain.telegram_message_id);
                const commentContent = typeof plain.comment === 'string' ? plain.comment : '';
                try {
                    if (typeof baseMessageId === 'number') {
                        const commentHtml = (0, taskComments_1.ensureCommentHtml)(commentContent);
                        commentMessageId = await (0, taskComments_1.syncCommentMessage)({
                            bot: bot_1.bot,
                            chatId: groupChatId,
                            topicId,
                            replyTo: baseMessageId,
                            messageId: previousCommentMessageId ?? undefined,
                            commentHtml,
                            detectors: {
                                notModified: this.isMessageNotModifiedError.bind(this),
                                missingOnEdit: this.isMessageMissingOnEditError.bind(this),
                                missingOnDelete: this.isMessageMissingOnDeleteError.bind(this),
                            },
                        });
                    }
                    else if (typeof previousCommentMessageId === 'number') {
                        await (0, taskComments_1.syncCommentMessage)({
                            bot: bot_1.bot,
                            chatId: groupChatId,
                            topicId,
                            messageId: previousCommentMessageId,
                            commentHtml: '',
                            detectors: {
                                missingOnDelete: this.isMessageMissingOnDeleteError.bind(this),
                            },
                        });
                        commentMessageId = undefined;
                    }
                }
                catch (error) {
                    console.error('Не удалось синхронизировать комментарий задачи', error);
                    commentMessageId = previousCommentMessageId ?? undefined;
                }
            }
            else {
                commentMessageId = previousCommentMessageId ?? undefined;
            }
            if (groupMessageId) {
                plain.telegram_message_id = groupMessageId;
            }
            else {
                delete plain.telegram_message_id;
            }
            delete plain.telegram_summary_message_id;
            delete plain.telegram_history_message_id;
            delete plain.telegram_status_message_id;
            if (typeof commentMessageId === 'number') {
                plain.telegram_comment_message_id = commentMessageId;
            }
            else {
                delete plain.telegram_comment_message_id;
            }
            plain.telegram_preview_message_ids = previewMessageIds;
            plain.telegram_attachments_message_ids = attachmentMessageIds;
            if (typeof photosMessageId === 'number' && photosChatId) {
                plain.telegram_photos_chat_id = photosChatId;
                if (typeof photosTopicId === 'number') {
                    plain.telegram_photos_topic_id = photosTopicId;
                }
                else {
                    delete plain.telegram_photos_topic_id;
                }
                plain.telegram_photos_message_id = photosMessageId;
            }
            else {
                delete plain.telegram_photos_chat_id;
                delete plain.telegram_photos_topic_id;
                delete plain.telegram_photos_message_id;
            }
            const previousDirectMessages = this.normalizeDirectMessages(previousPlain?.telegram_dm_message_ids);
            await this.deleteDirectMessages(previousDirectMessages);
            const assignees = this.collectAssignees(plain);
            const normalizedActorId = typeof actorId === 'number' || typeof actorId === 'string'
                ? Number(actorId)
                : NaN;
            if (Number.isFinite(normalizedActorId)) {
                // Не отправляем личное сообщение инициатору действия.
                assignees.delete(normalizedActorId);
            }
            if (assignees.size) {
                const dmKeyboard = (0, bot_1.buildDirectTaskKeyboard)(messageLink, taskAppLink ?? undefined);
                const dmOptions = {
                    parse_mode: 'HTML',
                    link_preview_options: { is_disabled: true },
                    ...(dmKeyboard?.reply_markup
                        ? { reply_markup: dmKeyboard.reply_markup }
                        : {}),
                };
                const dmText = (0, bot_1.buildDirectTaskMessage)(plain, messageLink, users, taskAppLink, dmNote ? { note: dmNote } : undefined);
                for (const userId of assignees) {
                    const profile = users[userId];
                    if (profile?.isBot) {
                        console.info(`Получатель ${userId} отмечен как бот, личное уведомление пропущено`);
                        continue;
                    }
                    try {
                        const sent = await bot_1.bot.telegram.sendMessage(userId, dmText, dmOptions);
                        if (sent?.message_id) {
                            directMessages.push({ user_id: userId, message_id: sent.message_id });
                        }
                    }
                    catch (error) {
                        if (this.isBotRecipientError(error)) {
                            console.warn(`Получатель ${userId} является ботом, личное уведомление не отправлено`, error);
                            if (profile) {
                                profile.isBot = true;
                            }
                            await this.markUserAsBot(userId);
                            continue;
                        }
                        console.error(`Не удалось отправить уведомление пользователю ${userId}`, error);
                    }
                }
            }
            plain.telegram_dm_message_ids = directMessages;
            const setPayload = {};
            const unsetPayload = {};
            if (groupMessageId) {
                setPayload.telegram_message_id = groupMessageId;
            }
            else {
                unsetPayload.telegram_message_id = '';
            }
            unsetPayload.telegram_summary_message_id = '';
            unsetPayload.telegram_history_message_id = '';
            unsetPayload.telegram_status_message_id = '';
            if (previewMessageIds.length) {
                setPayload.telegram_preview_message_ids = previewMessageIds;
            }
            else {
                unsetPayload.telegram_preview_message_ids = '';
            }
            if (attachmentMessageIds.length) {
                setPayload.telegram_attachments_message_ids = attachmentMessageIds;
            }
            else {
                unsetPayload.telegram_attachments_message_ids = '';
            }
            if (typeof photosMessageId === 'number' && photosChatId) {
                setPayload.telegram_photos_message_id = photosMessageId;
                setPayload.telegram_photos_chat_id = photosChatId;
                if (typeof photosTopicId === 'number') {
                    setPayload.telegram_photos_topic_id = photosTopicId;
                }
                else {
                    unsetPayload.telegram_photos_topic_id = '';
                }
            }
            else {
                unsetPayload.telegram_photos_message_id = '';
                unsetPayload.telegram_photos_chat_id = '';
                unsetPayload.telegram_photos_topic_id = '';
            }
            if (typeof commentMessageId === 'number') {
                setPayload.telegram_comment_message_id = commentMessageId;
            }
            else {
                unsetPayload.telegram_comment_message_id = '';
            }
            if (directMessages.length) {
                setPayload.telegram_dm_message_ids = directMessages;
            }
            else {
                unsetPayload.telegram_dm_message_ids = '';
            }
            unsetPayload.telegram_message_cleanup = '';
            const updatePayload = {};
            if (Object.keys(setPayload).length) {
                updatePayload.$set = setPayload;
            }
            if (Object.keys(unsetPayload).length) {
                updatePayload.$unset = unsetPayload;
            }
            if (Object.keys(updatePayload).length) {
                try {
                    await model_1.Task.findByIdAndUpdate(docId, updatePayload).exec();
                }
                catch (error) {
                    console.error('Не удалось сохранить идентификаторы сообщений задачи', error);
                }
            }
        }
        async notifyTaskCreated(task, creatorId) {
            await this.broadcastTaskSnapshot(task, creatorId, { action: 'создана' });
        }
        normalizeReportFilters(source) {
            const filters = { ...source };
            if (typeof filters.kind === 'string') {
                const trimmed = filters.kind.trim();
                if (trimmed === 'task' || trimmed === 'request') {
                    filters.kind = trimmed;
                }
                else {
                    delete filters.kind;
                }
            }
            if (typeof filters.from === 'string') {
                const trimmed = filters.from.trim();
                if (trimmed) {
                    filters.from = trimmed;
                }
                else {
                    delete filters.from;
                }
            }
            if (typeof filters.to === 'string') {
                const trimmed = filters.to.trim();
                if (trimmed) {
                    filters.to = trimmed;
                }
                else {
                    delete filters.to;
                }
            }
            return filters;
        }
    };
    __setFunctionName(_classThis, "TasksController");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        TasksController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return TasksController = _classThis;
})();
exports.default = TasksController;
