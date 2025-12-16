"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.__resetCloseThrottleForTests = exports.buildDirectTaskKeyboard = exports.buildDirectTaskMessage = exports.buildTaskAppLink = exports.bot = void 0;
exports.startBot = startBot;
exports.processStatusAction = processStatusAction;
exports.handleReportCommand = handleReportCommand;
// Назначение: основной файл Telegram-бота
// Основные модули: dotenv, telegraf, service, scheduler, config, taskHistory.service
require("dotenv/config");
const config_1 = require("../config");
const telegraf_1 = require("telegraf");
const messages_1 = __importDefault(require("../messages"));
const service_1 = require("../services/service");
require("../db/model");
const fleet_1 = require("../db/models/fleet");
const taskButtons_1 = require("../utils/taskButtons");
const taskStatusIcons_1 = require("../utils/taskStatusIcons");
const messageLink_1 = __importDefault(require("../utils/messageLink"));
const formatTask_1 = __importDefault(require("../utils/formatTask"));
const queries_1 = require("../db/queries");
const taskMessages_1 = require("../tasks/taskMessages");
const taskLinks_1 = require("../tasks/taskLinks");
const shared_1 = require("shared");
const taskSync_controller_1 = __importDefault(require("../controllers/taskSync.controller"));
const taskAlbumLink_1 = require("../utils/taskAlbumLink");
const taskComments_1 = require("../tasks/taskComments");
const attachments_1 = require("../utils/attachments");
const accessMask_1 = require("../utils/accessMask");
const assigneeIds_1 = require("../utils/assigneeIds");
const reportGenerator_1 = __importDefault(require("../services/reportGenerator"));
const tasks_service_1 = __importDefault(require("../tasks/tasks.service"));
const queries_2 = __importDefault(require("../db/queries"));
if (process.env.NODE_ENV !== 'production') {
    console.log('BOT_TOKEN загружен');
}
exports.bot = new telegraf_1.Telegraf(config_1.botToken);
const taskSyncController = new taskSync_controller_1.default(exports.bot);
const reportGenerator = new reportGenerator_1.default(new tasks_service_1.default(queries_2.default));
const REQUEST_TYPE_NAME = 'Заявка';
const resolveChatId = () => typeof config_1.getChatId === 'function' ? (0, config_1.getChatId)() : config_1.chatId;
class CancellationRequestError extends Error {
    constructor(code, message) {
        super(message !== null && message !== void 0 ? message : code);
        this.code = code;
        this.name = 'CancellationRequestError';
    }
}
const cancelRequestSessions = new Map();
const commentSessions = new Map();
const HISTORY_ALERT_LIMIT = 190;
const CANCEL_REASON_MIN_LENGTH = 50;
const CANCEL_REASON_MAX_LENGTH = 2000;
process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection in bot:', err);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception in bot:', err);
    process.exit(1);
});
function normalizeInlineKeyboard(markup) {
    if (!markup || typeof markup !== 'object') {
        return markup === undefined ? undefined : [];
    }
    const inline = Array.isArray(markup.inline_keyboard)
        ? markup.inline_keyboard
        : null;
    if (!inline) {
        return undefined;
    }
    return inline.map((row) => row
        .filter((button) => Boolean(button && typeof button === 'object'))
        .map((button) => normalizeButton(button)));
}
function normalizeButton(button) {
    const plain = button;
    return Object.fromEntries(Object.entries(plain)
        .filter(([, value]) => typeof value !== 'undefined')
        .sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0)));
}
function areInlineKeyboardsEqual(nextMarkup, currentMarkup) {
    if (!nextMarkup && !currentMarkup) {
        return true;
    }
    if (!nextMarkup || !currentMarkup) {
        return false;
    }
    const next = normalizeInlineKeyboard(nextMarkup);
    const current = normalizeInlineKeyboard(currentMarkup);
    if (!next || !current) {
        return false;
    }
    return JSON.stringify(next) === JSON.stringify(current);
}
function isMessageNotModifiedError(error) {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const record = error;
    const responseRaw = record.response;
    const response = responseRaw && typeof responseRaw === 'object'
        ? responseRaw
        : null;
    const descriptionSource = typeof (response === null || response === void 0 ? void 0 : response.description) === 'string'
        ? response.description
        : typeof record.description === 'string'
            ? record.description
            : '';
    const description = descriptionSource.toLowerCase();
    return ((response === null || response === void 0 ? void 0 : response.error_code) === 400 &&
        description.includes('message is not modified'));
}
function isMessageMissingOnEditError(error) {
    var _a, _b;
    if (!error || typeof error !== 'object') {
        return false;
    }
    const record = error;
    const errorCode = typeof ((_a = record.response) === null || _a === void 0 ? void 0 : _a.error_code) === 'number'
        ? record.response.error_code
        : typeof record.error_code === 'number'
            ? record.error_code
            : null;
    if (errorCode !== 400) {
        return false;
    }
    const descriptionSource = typeof ((_b = record.response) === null || _b === void 0 ? void 0 : _b.description) === 'string'
        ? record.response.description
        : typeof record.description === 'string'
            ? record.description
            : '';
    return descriptionSource.toLowerCase().includes('message to edit not found');
}
function buildHistoryAlert(summary) {
    const normalizedLines = summary
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    if (!normalizedLines.length) {
        return '';
    }
    const selected = [];
    for (let index = normalizedLines.length - 1; index >= 0; index -= 1) {
        const current = normalizedLines[index];
        if (!current) {
            continue;
        }
        if (!selected.length) {
            selected.unshift(current);
            continue;
        }
        const candidate = [current, ...selected].join('\n');
        if (candidate.length > HISTORY_ALERT_LIMIT) {
            break;
        }
        selected.unshift(current);
    }
    let text = selected.join('\n');
    if (!text) {
        return '';
    }
    if (text.length > HISTORY_ALERT_LIMIT) {
        text = `${text.slice(0, HISTORY_ALERT_LIMIT - 1)}…`;
    }
    return text;
}
const htmlEscapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};
const htmlEscapePattern = /[&<>"']/g;
const escapeHtml = (value) => String(value).replace(htmlEscapePattern, (char) => { var _a; return (_a = htmlEscapeMap[char]) !== null && _a !== void 0 ? _a : char; });
const normalizeReasonText = (reason) => {
    const normalized = reason.replace(/\r\n/g, '\n').trim();
    if (normalized.length <= CANCEL_REASON_MAX_LENGTH) {
        return normalized;
    }
    return normalized.slice(0, CANCEL_REASON_MAX_LENGTH);
};
const formatCancellationDescription = (identifier, reason, status) => {
    const parts = [];
    const trimmedIdentifier = identifier.trim();
    if (trimmedIdentifier) {
        parts.push(`<p><strong>Задача:</strong> ${escapeHtml(trimmedIdentifier)}</p>`);
    }
    const normalizedReason = reason.replace(/\r?\n/g, '\n');
    const reasonSegments = normalizedReason
        .split('\n')
        .map((segment) => escapeHtml(segment.trim()))
        .filter((segment) => segment.length > 0);
    const reasonHtml = reasonSegments.length
        ? reasonSegments.join('<br />')
        : escapeHtml(normalizedReason.trim());
    parts.push(`<p><strong>Причина удаления:</strong><br />${reasonHtml || '—'}</p>`);
    const statusTrimmed = typeof status === 'string' ? status.trim() : '';
    if (statusTrimmed) {
        parts.push(`<p><strong>Текущий статус:</strong> ${escapeHtml(statusTrimmed)}</p>`);
    }
    return parts.join('');
};
const toPlainTask = (task) => typeof task.toObject === 'function'
    ? task.toObject()
    : task;
async function loadCancelRequestContext(taskId, actorId) {
    var _a;
    const task = await (0, service_1.getTask)(taskId);
    if (!task) {
        throw new CancellationRequestError('not_found');
    }
    const plain = toPlainTask(task);
    const kind = detectTaskKind(plain);
    if (kind !== 'task') {
        throw new CancellationRequestError('unsupported');
    }
    if (!isTaskExecutor(plain, actorId)) {
        throw new CancellationRequestError('not_executor');
    }
    const creatorId = Number(plain.created_by);
    if (!Number.isFinite(creatorId) || creatorId === 0) {
        throw new CancellationRequestError('creator_missing');
    }
    const identifier = (0, taskMessages_1.getTaskIdentifier)(plain) ||
        taskId;
    const docId = typeof plain._id === 'object' &&
        plain._id !== null &&
        'toString' in plain._id
        ? plain._id.toString()
        : String((_a = plain._id) !== null && _a !== void 0 ? _a : taskId);
    return { plain, creatorId, identifier, docId };
}
async function createCancellationRequestFromTask(taskId, actorId, reason) {
    var _a;
    const context = await loadCancelRequestContext(taskId, actorId);
    const { plain, creatorId, identifier, docId } = context;
    const normalizedReason = normalizeReasonText(reason);
    const description = formatCancellationDescription(identifier, normalizedReason, typeof plain.status === 'string' ? plain.status : undefined);
    const payload = {
        title: `Запрос на отмену задачи ${identifier}`,
        task_description: description,
        kind: 'request',
        task_type: REQUEST_TYPE_NAME,
        status: 'Новая',
        created_by: actorId,
        custom: {
            cancelSource: {
                taskId: docId,
                identifier,
                requestedBy: actorId,
                requestedAt: new Date().toISOString(),
            },
            cancelReason: normalizedReason,
        },
    };
    if (Number.isFinite(creatorId) && creatorId !== 0) {
        payload.assigned_user_id = creatorId;
        payload.assignees = [creatorId];
    }
    const created = await (0, queries_1.createTask)(payload, actorId);
    const requestId = typeof created._id === 'object' &&
        created._id !== null &&
        'toString' in created._id
        ? created._id.toString()
        : String((_a = created._id) !== null && _a !== void 0 ? _a : '');
    if (requestId) {
        try {
            await taskSyncController.onWebTaskUpdate(requestId, created);
        }
        catch (error) {
            console.error('Не удалось синхронизировать заявку на удаление задачи', error);
        }
    }
    try {
        await (0, service_1.writeLog)(`Создана заявка ${requestId} пользователем ${actorId}/telegram`);
    }
    catch (error) {
        console.error('Не удалось записать лог создания заявки', error);
    }
    return { requestId, identifier };
}
async function updateMessageReplyMarkup(ctx, markup) {
    const existingMarkup = extractInlineKeyboardMarkup(ctx);
    if (areInlineKeyboardsEqual(markup, existingMarkup)) {
        return;
    }
    try {
        await ctx.editMessageReplyMarkup(markup);
    }
    catch (error) {
        if (isMessageNotModifiedError(error)) {
            return;
        }
        if (isMessageMissingOnEditError(error)) {
            const callback = ctx.callbackQuery;
            if (callback && typeof callback === 'object' && 'data' in callback) {
                const rawData = typeof callback.data === 'string' ? callback.data : null;
                if (rawData) {
                    const [, taskId] = rawData.split(':');
                    if (taskId) {
                        try {
                            await taskSyncController.syncAfterChange(taskId);
                        }
                        catch (syncError) {
                            console.error('Не удалось пересоздать сообщение задачи после отсутствующей клавиатуры', syncError);
                        }
                    }
                }
            }
            return;
        }
        throw error;
    }
}
function extractInlineKeyboardMarkup(ctx) {
    var _a;
    const rawMessage = (_a = ctx.callbackQuery) === null || _a === void 0 ? void 0 : _a.message;
    if (!rawMessage || typeof rawMessage !== 'object') {
        return undefined;
    }
    const candidate = rawMessage;
    const markup = candidate.reply_markup;
    if (!markup || typeof markup !== 'object') {
        return undefined;
    }
    const maybeKeyboard = markup;
    return Array.isArray(maybeKeyboard.inline_keyboard)
        ? markup
        : undefined;
}
async function showMainMenu(ctx) {
    await ctx.reply(messages_1.default.menuPrompt, telegraf_1.Markup.keyboard([['Регистрация в ERM'], ['ERM веб-клиент']]).resize());
}
async function checkAndRegister(ctx) {
    var _a;
    try {
        const chatId = resolveChatId();
        if (!chatId) {
            await ctx.reply(messages_1.default.accessError);
            return;
        }
        const member = await exports.bot.telegram.getChatMember(chatId, ctx.from.id);
        if (!['creator', 'administrator', 'member'].includes(member.status)) {
            await ctx.reply(messages_1.default.accessOnlyGroup);
            return;
        }
    }
    catch {
        await ctx.reply(messages_1.default.accessError);
        return;
    }
    const user = await (0, service_1.getUser)(ctx.from.id);
    if (user) {
        await ctx.reply(messages_1.default.welcomeBack);
    }
    else {
        await (0, service_1.createUser)(ctx.from.id, ((_a = ctx.from) === null || _a === void 0 ? void 0 : _a.username) || '');
        await ctx.reply(messages_1.default.registrationSuccess);
    }
}
exports.bot.start(async (ctx) => {
    await checkAndRegister(ctx);
    await showMainMenu(ctx);
});
exports.bot.command('register', checkAndRegister);
exports.bot.hears(['Регистрация', 'Регистрация в ERM'], checkAndRegister);
exports.bot.hears(['ERM', 'ERM веб-клиент'], async (ctx) => {
    await ctx.reply(messages_1.default.ermLink);
});
function formatVehicleLine(vehicle) {
    const parts = [`Регистрация: ${vehicle.registrationNumber}`];
    parts.push(`Тип транспорта: ${vehicle.transportType}`);
    parts.push(`Одометр: старт ${vehicle.odometerInitial} км, текущее ${vehicle.odometerCurrent} км`);
    parts.push(`Пробег: ${vehicle.mileageTotal} км`);
    parts.push(`Топливо: ${vehicle.fuelType}`);
    parts.push(`Заправлено: ${vehicle.fuelRefilled}`);
    parts.push(`Средний расход: ${vehicle.fuelAverageConsumption} л/км`);
    parts.push(`Израсходовано: ${vehicle.fuelSpentTotal} л`);
    if (vehicle.currentTasks.length) {
        parts.push(`Текущие задачи: ${vehicle.currentTasks.join(', ')}`);
    }
    return `• ${vehicle.name}\n${parts.join('\n')}`;
}
async function sendFleetVehicles(ctx) {
    try {
        const vehicles = await fleet_1.FleetVehicle.find().sort({ name: 1 }).lean();
        if (!vehicles.length) {
            await ctx.reply(messages_1.default.noVehicles);
            return;
        }
        const lines = vehicles.map((vehicle) => formatVehicleLine({
            name: vehicle.name,
            registrationNumber: vehicle.registrationNumber,
            odometerInitial: vehicle.odometerInitial,
            odometerCurrent: vehicle.odometerCurrent,
            mileageTotal: vehicle.mileageTotal,
            transportType: vehicle.transportType,
            fuelType: vehicle.fuelType,
            fuelRefilled: vehicle.fuelRefilled,
            fuelAverageConsumption: vehicle.fuelAverageConsumption,
            fuelSpentTotal: vehicle.fuelSpentTotal,
            currentTasks: vehicle.currentTasks,
        }));
        await ctx.reply(lines.join('\n\n'));
    }
    catch (error) {
        console.error('Не удалось отправить список транспорта:', error);
        await ctx.reply(messages_1.default.vehiclesError);
    }
}
async function handleReportCommand(ctx) {
    var _a, _b;
    const fromId = (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id;
    if (typeof fromId !== 'number' || !Number.isFinite(fromId)) {
        await ctx.reply(messages_1.default.reportGenerationError);
        return;
    }
    const user = await (0, service_1.getUser)(fromId);
    if (!hasAdminPrivileges(user)) {
        await ctx.reply(messages_1.default.reportAdminsOnly);
        return;
    }
    const reportUser = user
        ? {
            id: typeof user.telegram_id === 'number'
                ? user.telegram_id
                : ((_b = user.id) !== null && _b !== void 0 ? _b : undefined),
            role: user.role,
            access: user.access,
        }
        : undefined;
    try {
        const [pdfReport, excelReport] = await Promise.all([
            reportGenerator.generatePdf({}, reportUser),
            reportGenerator.generateExcel({}, reportUser),
        ]);
        await ctx.replyWithDocument({
            source: pdfReport.data,
            filename: pdfReport.fileName,
        });
        await ctx.replyWithDocument({
            source: excelReport.data,
            filename: excelReport.fileName,
        });
        await ctx.reply(messages_1.default.reportGenerationSuccess);
    }
    catch (error) {
        console.error('Не удалось сформировать отчёты задач', error);
        await ctx.reply(messages_1.default.reportGenerationError);
    }
}
exports.bot.command('vehicles', sendFleetVehicles);
exports.bot.hears('Транспорт', sendFleetVehicles);
exports.bot.command('report', handleReportCommand);
const MAX_RETRIES = 5;
const sleep = (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});
const extractTelegramErrorCode = (error) => {
    var _a;
    if (!error || typeof error !== 'object') {
        return null;
    }
    const record = error;
    const directCode = typeof record.error_code === 'number' ? record.error_code : null;
    if (directCode !== null) {
        return directCode;
    }
    const responseCode = typeof ((_a = record.response) === null || _a === void 0 ? void 0 : _a.error_code) === 'number'
        ? record.response.error_code
        : null;
    return responseCode;
};
const extractRetryAfterSeconds = (error) => {
    var _a;
    if (!error || typeof error !== 'object') {
        return null;
    }
    const record = error;
    const candidates = [record.parameters, (_a = record.response) === null || _a === void 0 ? void 0 : _a.parameters];
    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'object') {
            continue;
        }
        const retryAfterRaw = candidate.retry_after;
        const retryAfter = Number(retryAfterRaw);
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
            return Math.ceil(retryAfter);
        }
    }
    return null;
};
const waitForRetryAfter = async (error, context) => {
    if (extractTelegramErrorCode(error) !== 429) {
        return null;
    }
    const retryAfterSeconds = extractRetryAfterSeconds(error);
    if (!retryAfterSeconds) {
        return null;
    }
    console.warn(`${context}; повторная попытка через ${retryAfterSeconds} с`);
    await sleep(retryAfterSeconds * 1000);
    return retryAfterSeconds;
};
const CLOSE_RETRY_GRACE_MS = 2000;
let closeThrottleUntil = 0;
const resetLongPollingSession = async () => {
    try {
        exports.bot.stop('telegram:retry');
    }
    catch (stopError) {
        console.warn('Не удалось локально остановить экземпляр бота перед повторным запуском', stopError);
    }
    try {
        await exports.bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.warn('Webhook удалён, обновления сброшены перед повторным запуском');
    }
    catch (deleteError) {
        console.error('Не удалось удалить webhook перед повторным запуском long polling', deleteError);
    }
    const now = Date.now();
    if (now < closeThrottleUntil) {
        const remainingSeconds = Math.ceil((closeThrottleUntil - now) / 1000);
        console.warn(`Пропускаем завершение long polling методом close, осталось ожидать ${remainingSeconds} с`);
        return;
    }
    try {
        await exports.bot.telegram.callApi('close', {});
        closeThrottleUntil = 0;
        console.warn('Текущая long polling сессия Telegram завершена методом close');
    }
    catch (closeError) {
        const retryAfterSeconds = extractRetryAfterSeconds(closeError);
        if (retryAfterSeconds) {
            closeThrottleUntil =
                Date.now() + retryAfterSeconds * 1000 + CLOSE_RETRY_GRACE_MS;
        }
        console.error('Не удалось завершить предыдущую long polling сессию методом close', closeError);
        await waitForRetryAfter(closeError, 'Получена ошибка 429 от метода close');
    }
};
const getCallbackData = (callback) => {
    if (!callback)
        return null;
    if ('data' in callback && typeof callback.data === 'string')
        return callback.data;
    return null;
};
const getTaskIdFromCallback = (data) => {
    if (!data)
        return null;
    const [, taskId] = data.split(':');
    const normalized = typeof taskId === 'string' ? taskId.trim() : '';
    return normalized || null;
};
const directMessageDateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: shared_1.PROJECT_TIMEZONE,
});
const statusDisplayMap = {
    Новая: `${taskStatusIcons_1.TASK_STATUS_ICON_MAP['Новая']} Новая`,
    'В работе': `${taskStatusIcons_1.TASK_STATUS_ICON_MAP['В работе']} В работе`,
    Выполнена: `${taskStatusIcons_1.TASK_STATUS_ICON_MAP['Выполнена']} Выполнена`,
    Отменена: `${taskStatusIcons_1.TASK_STATUS_ICON_MAP['Отменена']} Отменена`,
};
var taskLinks_2 = require("../tasks/taskLinks");
Object.defineProperty(exports, "buildTaskAppLink", { enumerable: true, get: function () { return taskLinks_2.buildTaskAppLink; } });
const htmlEscape = (value) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const formatDateTimeLabel = (value) => {
    if (!value)
        return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime()))
        return null;
    const formatted = directMessageDateFormatter.format(date).replace(', ', ' ');
    return `${formatted} (${shared_1.PROJECT_TIMEZONE_LABEL})`;
};
const toNumericId = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};
const collectTaskUserIds = (task) => {
    const ids = new Set();
    const singleKeys = [
        'assigned_user_id',
        'controller_user_id',
        'created_by',
        'transport_driver_id',
    ];
    singleKeys.forEach((key) => {
        const value = task[key];
        const id = (0, assigneeIds_1.normalizeUserId)(value);
        if (id !== null) {
            ids.add(id);
        }
    });
    const arrayKeys = ['assignees', 'controllers'];
    arrayKeys.forEach((key) => {
        const raw = task[key];
        (0, assigneeIds_1.collectAssigneeIds)(raw).forEach((id) => ids.add(id));
    });
    return Array.from(ids);
};
const hasAdminPrivileges = (user) => {
    if (!user) {
        return false;
    }
    if (user.role === 'admin') {
        return true;
    }
    const mask = typeof user.access === 'number' ? user.access : 0;
    return (mask & accessMask_1.ACCESS_ADMIN) === accessMask_1.ACCESS_ADMIN;
};
const buildUsersIndex = async (ids) => {
    if (!ids.length) {
        return {};
    }
    try {
        const raw = await (0, queries_1.getUsersMap)(ids);
        const entries = Object.entries(raw !== null && raw !== void 0 ? raw : {})
            .map(([key, value]) => {
            const numericId = Number(key);
            if (!Number.isFinite(numericId)) {
                return null;
            }
            const name = typeof (value === null || value === void 0 ? void 0 : value.name) === 'string' && value.name.trim()
                ? value.name.trim()
                : '';
            const username = typeof (value === null || value === void 0 ? void 0 : value.username) === 'string' && value.username.trim()
                ? value.username.trim()
                : '';
            const isBot = (value === null || value === void 0 ? void 0 : value.is_bot) === true;
            return [numericId, { name, username, isBot }];
        })
            .filter((entry) => entry !== null);
        return Object.fromEntries(entries);
    }
    catch (error) {
        console.error('Не удалось получить данные пользователей задачи', error);
        return {};
    }
};
const detectTaskKind = (task) => {
    if (!task || typeof task !== 'object') {
        return 'task';
    }
    const source = task;
    const rawKind = typeof source.kind === 'string' ? source.kind.trim().toLowerCase() : '';
    if (rawKind === 'request') {
        return 'request';
    }
    const typeValue = typeof source.task_type === 'string' ? source.task_type.trim() : '';
    return typeValue === REQUEST_TYPE_NAME ? 'request' : 'task';
};
const isTaskExecutor = (task, userId) => {
    if (!task || typeof task !== 'object' || !Number.isFinite(userId)) {
        return false;
    }
    const source = task;
    const assignedNumeric = (0, assigneeIds_1.normalizeUserId)(source.assigned_user_id);
    if (assignedNumeric !== null && assignedNumeric === userId) {
        return true;
    }
    const assignees = (0, assigneeIds_1.collectAssigneeIds)(source.assignees);
    return assignees.includes(userId);
};
const isTaskCreator = (task, userId) => {
    if (!task || typeof task !== 'object' || !Number.isFinite(userId)) {
        return false;
    }
    const source = task;
    const creatorNumeric = Number(source.created_by);
    return Number.isFinite(creatorNumeric) && creatorNumeric === userId;
};
const isTaskRelatedUser = (task, userId) => {
    if (!task || typeof task !== 'object' || !Number.isFinite(userId)) {
        return false;
    }
    return collectTaskUserIds(task).includes(userId);
};
const formatCoordinates = (value) => {
    if (!value || typeof value !== 'object')
        return null;
    const candidate = value;
    const lat = Number(candidate.lat);
    const lng = Number(candidate.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};
const buildDirectTaskMessage = (task, link, users, appLink = null, options) => {
    const lines = [];
    const note = typeof (options === null || options === void 0 ? void 0 : options.note) === 'string' ? options.note.trim() : '';
    if (note) {
        lines.push(`<i>${htmlEscape(note)}</i>`);
    }
    const identifier = (0, taskMessages_1.getTaskIdentifier)(task);
    const title = typeof task.title === 'string' ? task.title.trim() : '';
    const headerContent = (() => {
        if (link) {
            const label = identifier ? htmlEscape(identifier) : 'по ссылке';
            return `<a href="${link}">${label}</a>`;
        }
        return identifier
            ? `<b>${htmlEscape(identifier)}</b>`
            : '<b>без номера</b>';
    })();
    lines.push(`Задача ${headerContent}`);
    if (title) {
        lines.push(`Название: <b>${htmlEscape(title)}</b>`);
    }
    const status = task.status && statusDisplayMap[task.status];
    if (status) {
        lines.push(`Статус: <b>${htmlEscape(status)}</b>`);
    }
    const dueLabel = formatDateTimeLabel(task.due_date);
    if (dueLabel) {
        lines.push(`Срок: <code>${htmlEscape(dueLabel)}</code>`);
    }
    const startLocation = typeof task.start_location === 'string' ? task.start_location.trim() : '';
    const endLocation = typeof task.end_location === 'string' ? task.end_location.trim() : '';
    const startLink = typeof task.start_location_link === 'string'
        ? task.start_location_link.trim()
        : '';
    const endLink = typeof task.end_location_link === 'string'
        ? task.end_location_link.trim()
        : '';
    if (startLocation) {
        const coords = formatCoordinates(task.startCoordinates);
        const label = startLink
            ? `<a href="${startLink}">${htmlEscape(startLocation)}</a>`
            : htmlEscape(startLocation);
        lines.push(`Старт: ${label}${coords ? ` (<code>${htmlEscape(coords)}</code>)` : ''}`);
    }
    if (endLocation) {
        const coords = formatCoordinates(task.finishCoordinates);
        const label = endLink
            ? `<a href="${endLink}">${htmlEscape(endLocation)}</a>`
            : htmlEscape(endLocation);
        lines.push(`Финиш: ${label}${coords ? ` (<code>${htmlEscape(coords)}</code>)` : ''}`);
    }
    const distance = Number(task.route_distance_km);
    if (Number.isFinite(distance) && distance > 0) {
        lines.push(`Логистика: <b>${htmlEscape(`${distance} км`)}</b>`);
    }
    const assignees = Array.isArray(task.assignees)
        ? task.assignees
            .map((item) => {
            const id = toNumericId(item);
            if (id === null)
                return null;
            const profile = users[id];
            const display = (profile === null || profile === void 0 ? void 0 : profile.name) || (profile === null || profile === void 0 ? void 0 : profile.username) || `#${id}`;
            return htmlEscape(display);
        })
            .filter((value) => Boolean(value))
        : [];
    if (assignees.length) {
        lines.push(`Исполнители: ${assignees.join(', ')}`);
    }
    if (appLink) {
        lines.push(`Веб-версия: <a href="${htmlEscape(appLink)}">Открыть задачу</a>`);
    }
    return lines.join('\n');
};
exports.buildDirectTaskMessage = buildDirectTaskMessage;
const buildDirectTaskKeyboard = (link, appLink = null) => {
    const row = [];
    if (appLink) {
        row.push({ text: 'Открыть в веб-версии', url: appLink });
    }
    if (link) {
        row.push({ text: 'Открыть в чате', url: link });
    }
    if (!row.length) {
        return undefined;
    }
    if (typeof telegraf_1.Markup.inlineKeyboard !== 'function') {
        console.warn('Пропущено построение inline-клавиатуры: отсутствует поддержка');
        return undefined;
    }
    const keyboard = telegraf_1.Markup.inlineKeyboard([row]);
    if (!keyboard.reply_markup) {
        keyboard.reply_markup = {
            inline_keyboard: [row],
        };
    }
    return keyboard;
};
exports.buildDirectTaskKeyboard = buildDirectTaskKeyboard;
const loadTaskContext = async (taskId, override) => {
    if (override) {
        const ids = collectTaskUserIds(override);
        const users = await buildUsersIndex(ids);
        return { plain: override, users };
    }
    try {
        const taskDoc = await (0, service_1.getTask)(taskId);
        if (!taskDoc) {
            return { plain: null, users: {} };
        }
        const plainRaw = typeof taskDoc.toObject === 'function'
            ? taskDoc.toObject()
            : taskDoc;
        const plain = plainRaw;
        const ids = collectTaskUserIds(plain);
        const users = await buildUsersIndex(ids);
        return { plain, users };
    }
    catch (error) {
        console.error('Не удалось загрузить данные задачи для Telegram', error);
        return { plain: null, users: {} };
    }
};
const syncTaskPresentation = async (taskId, override) => {
    const context = await loadTaskContext(taskId, override);
    const { plain, users } = context;
    if (!plain) {
        return context;
    }
    const chatId = resolveChatId();
    if (!chatId) {
        return context;
    }
    try {
        const messageId = toNumericId(plain.telegram_message_id);
        const topicId = toNumericId(plain.telegram_topic_id);
        const status = typeof plain.status === 'string'
            ? plain.status
            : undefined;
        if (messageId !== null) {
            const formatted = (0, formatTask_1.default)(plain, users);
            const kind = detectTaskKind(plain);
            const albumLink = (0, taskAlbumLink_1.resolveTaskAlbumLink)(plain, {
                fallbackChatId: chatId,
                fallbackTopicId: topicId,
            });
            const replyMarkup = (0, taskButtons_1.taskStatusInlineMarkup)(taskId, status, { kind }, albumLink ? { albumLink } : undefined);
            const options = {
                parse_mode: 'MarkdownV2',
                link_preview_options: { is_disabled: true },
                reply_markup: replyMarkup,
            };
            try {
                await exports.bot.telegram.editMessageText(chatId, messageId, undefined, formatted.text, options);
            }
            catch (error) {
                if (isMessageNotModifiedError(error)) {
                    // Сообщение не изменилось — обновление не требуется
                }
                else if (isMessageMissingOnEditError(error)) {
                    console.info('Сообщение задачи отсутствует в Telegram, выполняем пересинхронизацию', { taskId, messageId });
                    try {
                        await taskSyncController.syncAfterChange(taskId);
                    }
                    catch (syncError) {
                        console.error('Не удалось пересоздать сообщение задачи после ошибки editMessageText', syncError);
                    }
                    try {
                        return await loadTaskContext(taskId);
                    }
                    catch (reloadError) {
                        console.error('Не удалось обновить контекст задачи после пересинхронизации', reloadError);
                    }
                }
                else {
                    throw error;
                }
            }
        }
    }
    catch (error) {
        console.error('Не удалось обновить представление задачи в Telegram', error);
    }
    return context;
};
async function ensureUserCanUpdateTask(ctx, taskId, userId, logContext, options = {}) {
    try {
        const task = await (0, service_1.getTask)(taskId);
        if (!task) {
            await ctx.answerCbQuery(messages_1.default.taskNotFound, { show_alert: true });
            return false;
        }
        const assignedUserId = (0, assigneeIds_1.normalizeUserId)(task.assigned_user_id);
        const assignees = (0, assigneeIds_1.collectAssigneeIds)(task.assignees);
        const hasAssignments = assignedUserId !== null || assignees.length > 0;
        const isAllowed = (assignedUserId !== null && assignedUserId === userId) ||
            assignees.includes(userId);
        const kind = detectTaskKind(task);
        const creatorId = Number(task.created_by);
        const isCreator = Number.isFinite(creatorId) && creatorId === userId;
        const allowCreatorCancellation = options.targetStatus === 'Отменена' && kind === 'request' && isCreator;
        if (hasAssignments && !isAllowed && !allowCreatorCancellation) {
            await ctx.answerCbQuery(messages_1.default.taskAssignmentRequired, {
                show_alert: true,
            });
            return false;
        }
        return true;
    }
    catch (error) {
        console.error(logContext, error);
        await ctx.answerCbQuery(messages_1.default.taskPermissionError, { show_alert: true });
        return false;
    }
}
async function refreshTaskKeyboard(ctx, taskId, snapshot) {
    var _a, _b, _c, _d;
    let context = snapshot !== null && snapshot !== void 0 ? snapshot : { plain: null, users: {} };
    if (!snapshot) {
        try {
            const taskDoc = await (0, service_1.getTask)(taskId);
            if (taskDoc) {
                const plainSource = typeof taskDoc.toObject ===
                    'function'
                    ? taskDoc.toObject()
                    : taskDoc;
                context = { plain: plainSource, users: {} };
            }
        }
        catch (error) {
            console.error('Не удалось получить задачу для обновления клавиатуры', error);
        }
    }
    const plain = context.plain;
    const status = typeof (plain === null || plain === void 0 ? void 0 : plain.status) === 'string'
        ? plain.status
        : undefined;
    const messageId = toNumericId((_a = plain === null || plain === void 0 ? void 0 : plain.telegram_message_id) !== null && _a !== void 0 ? _a : null);
    const topicId = toNumericId((_b = plain === null || plain === void 0 ? void 0 : plain.telegram_topic_id) !== null && _b !== void 0 ? _b : null);
    const chatId = resolveChatId();
    const link = (0, messageLink_1.default)(chatId, messageId !== null && messageId !== void 0 ? messageId : undefined, topicId !== null && topicId !== void 0 ? topicId : undefined);
    if (((_c = ctx.chat) === null || _c === void 0 ? void 0 : _c.type) === 'private') {
        const appLink = plain ? (0, taskLinks_1.buildTaskAppLink)(plain) : null;
        const keyboard = (0, exports.buildDirectTaskKeyboard)(link, appLink !== null && appLink !== void 0 ? appLink : undefined);
        await updateMessageReplyMarkup(ctx, (_d = keyboard === null || keyboard === void 0 ? void 0 : keyboard.reply_markup) !== null && _d !== void 0 ? _d : undefined);
    }
    else {
        const kind = detectTaskKind(plain !== null && plain !== void 0 ? plain : undefined);
        const albumLink = plain
            ? (0, taskAlbumLink_1.resolveTaskAlbumLink)(plain, {
                fallbackChatId: chatId,
                fallbackTopicId: topicId,
            })
            : null;
        const replyMarkup = (0, taskButtons_1.taskStatusInlineMarkup)(taskId, status, { kind }, albumLink ? { albumLink } : undefined);
        await updateMessageReplyMarkup(ctx, replyMarkup);
    }
    return context;
}
async function denyCancellation(ctx, taskId, message) {
    try {
        await refreshTaskKeyboard(ctx, taskId);
    }
    catch (error) {
        console.error('Не удалось обновить клавиатуру после запрета отмены', error);
    }
    await ctx.answerCbQuery(message !== null && message !== void 0 ? message : messages_1.default.taskCancelForbidden, {
        show_alert: true,
    });
}
async function processStatusAction(ctx, status, responseMessage) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const data = getCallbackData(ctx.callbackQuery);
    const taskId = data === null || data === void 0 ? void 0 : data.split(':')[1];
    if (!taskId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusInvalidId, {
            show_alert: true,
        });
        return;
    }
    const userId = (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusUnknownUser, {
            show_alert: true,
        });
        return;
    }
    let snapshot = { plain: null, users: {} };
    try {
        const current = await (0, service_1.getTask)(taskId);
        if (current) {
            const plainSource = typeof current.toObject === 'function'
                ? current.toObject()
                : current;
            snapshot = { plain: plainSource, users: {} };
        }
    }
    catch (error) {
        console.error('Не удалось получить задачу перед обновлением статуса', error);
    }
    if (status === 'Отменена') {
        const snapshotTask = snapshot.plain;
        if (!snapshotTask) {
            await denyCancellation(ctx, taskId);
            return;
        }
        const kind = detectTaskKind(snapshotTask);
        const creator = isTaskCreator(snapshotTask, userId);
        if (kind === 'request') {
            if (!creator && !isTaskExecutor(snapshotTask, userId)) {
                await denyCancellation(ctx, taskId, messages_1.default.requestCancelExecutorOnly);
                return;
            }
        }
        else if (!creator) {
            await denyCancellation(ctx, taskId);
            return;
        }
    }
    try {
        const currentStatus = (_b = snapshot.plain) === null || _b === void 0 ? void 0 : _b.status;
        if (typeof currentStatus === 'string' &&
            currentStatus === 'Выполнена' &&
            status !== 'Выполнена') {
            try {
                await refreshTaskKeyboard(ctx, taskId, snapshot);
            }
            catch (error) {
                console.error('Не удалось восстановить клавиатуру статуса', error);
            }
            await ctx.answerCbQuery(messages_1.default.taskCompletedLock, {
                show_alert: true,
            });
            return;
        }
        let docId = taskId;
        const updatedPlain = await taskSyncController.onTelegramAction(taskId, status, userId);
        if (!updatedPlain) {
            await ctx.answerCbQuery(messages_1.default.taskNotFound, { show_alert: true });
            return;
        }
        docId =
            typeof updatedPlain._id === 'object' &&
                updatedPlain._id !== null &&
                'toString' in updatedPlain._id
                ? updatedPlain._id.toString()
                : String((_c = updatedPlain._id) !== null && _c !== void 0 ? _c : taskId);
        const override = updatedPlain;
        const presentation = await syncTaskPresentation(docId, override !== null && override !== void 0 ? override : undefined);
        const appliedStatus = ((_e = (_d = presentation.plain) === null || _d === void 0 ? void 0 : _d.status) !== null && _e !== void 0 ? _e : status);
        const plainForView = {
            ...(override !== null && override !== void 0 ? override : {}),
            ...((_f = presentation.plain) !== null && _f !== void 0 ? _f : {}),
            status: appliedStatus,
        };
        const messageId = toNumericId((_g = plainForView === null || plainForView === void 0 ? void 0 : plainForView.telegram_message_id) !== null && _g !== void 0 ? _g : null);
        const topicId = toNumericId((_h = plainForView === null || plainForView === void 0 ? void 0 : plainForView.telegram_topic_id) !== null && _h !== void 0 ? _h : null);
        const chatId = resolveChatId();
        const link = (0, messageLink_1.default)(chatId, messageId !== null && messageId !== void 0 ? messageId : undefined, topicId !== null && topicId !== void 0 ? topicId : undefined);
        const appLink = plainForView ? (0, taskLinks_1.buildTaskAppLink)(plainForView) : null;
        if (((_j = ctx.chat) === null || _j === void 0 ? void 0 : _j.type) === 'private') {
            const keyboard = (0, exports.buildDirectTaskKeyboard)(link, appLink !== null && appLink !== void 0 ? appLink : undefined);
            const inlineMarkup = (_k = keyboard === null || keyboard === void 0 ? void 0 : keyboard.reply_markup) !== null && _k !== void 0 ? _k : undefined;
            if (inlineMarkup) {
                await updateMessageReplyMarkup(ctx, undefined);
            }
            const dmText = (0, exports.buildDirectTaskMessage)(plainForView, link, presentation.users, appLink);
            try {
                await ctx.editMessageText(dmText, {
                    parse_mode: 'HTML',
                    link_preview_options: { is_disabled: true },
                    ...(inlineMarkup ? { reply_markup: inlineMarkup } : {}),
                });
                if (!inlineMarkup) {
                    await updateMessageReplyMarkup(ctx, undefined);
                }
            }
            catch (error) {
                console.warn('Не удалось обновить личное уведомление задачи', error);
                try {
                    await updateMessageReplyMarkup(ctx, inlineMarkup);
                }
                catch (updateError) {
                    console.warn('Не удалось обновить клавиатуру уведомления', updateError);
                }
            }
        }
        else {
            try {
                await refreshTaskKeyboard(ctx, taskId, {
                    plain: plainForView,
                    users: presentation.users,
                });
            }
            catch (error) {
                console.warn('Не удалось обновить клавиатуру статуса', error);
            }
        }
        await ctx.answerCbQuery(responseMessage);
    }
    catch (error) {
        console.error('Не удалось обновить статус задачи', error);
        await ctx.answerCbQuery(messages_1.default.taskStatusUpdateError, {
            show_alert: true,
        });
    }
}
exports.bot.action('task_accept', async (ctx) => {
    await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});
exports.bot.action(/^task_history:.+$/, async (ctx) => {
    var _a;
    const data = getCallbackData(ctx.callbackQuery);
    const taskId = getTaskIdFromCallback(data);
    if (!taskId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusInvalidId, {
            show_alert: true,
        });
        return;
    }
    try {
        const task = await (0, service_1.getTask)(taskId);
        if (!task) {
            await ctx.answerCbQuery(messages_1.default.taskNotFound, { show_alert: true });
            return;
        }
        const userId = (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            await ctx.answerCbQuery(messages_1.default.taskStatusUnknownUser, {
                show_alert: true,
            });
            return;
        }
        const plain = toPlainTask(task);
        if (!isTaskRelatedUser(plain, userId)) {
            console.warn('Попытка просмотра истории задачи без назначения', taskId, userId);
            await ctx.answerCbQuery(messages_1.default.taskAssignmentRequired, {
                show_alert: true,
            });
            return;
        }
        const summary = await (0, taskMessages_1.buildHistorySummaryLog)(plain);
        if (!summary) {
            await ctx.answerCbQuery(messages_1.default.taskHistoryEmpty, { show_alert: true });
            return;
        }
        const alertText = buildHistoryAlert(summary);
        if (!alertText) {
            await ctx.answerCbQuery(messages_1.default.taskHistoryEmpty, {
                show_alert: true,
            });
            return;
        }
        await ctx.answerCbQuery(alertText, { show_alert: true });
    }
    catch (error) {
        console.error('Не удалось показать историю задачи в Telegram', error);
        await ctx.answerCbQuery(messages_1.default.taskHistoryPopupError, {
            show_alert: true,
        });
    }
});
exports.bot.action(/^task_comment_prompt:.+$/, async (ctx) => {
    var _a, _b;
    const data = getCallbackData(ctx.callbackQuery);
    const taskId = getTaskIdFromCallback(data);
    if (!taskId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusInvalidId, {
            show_alert: true,
        });
        return;
    }
    const userId = (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusUnknownUser, {
            show_alert: true,
        });
        return;
    }
    try {
        const context = await loadTaskContext(taskId);
        const plain = context.plain;
        if (!plain) {
            await ctx.answerCbQuery(messages_1.default.taskNotFound, {
                show_alert: true,
            });
            return;
        }
        const userRecord = await (0, service_1.getUser)(userId);
        const allowed = hasAdminPrivileges(userRecord) ||
            isTaskCreator(plain, userId) ||
            isTaskExecutor(plain, userId);
        if (!allowed) {
            await ctx.answerCbQuery(messages_1.default.taskPermissionError, {
                show_alert: true,
            });
            return;
        }
        const identifier = (_b = (0, taskMessages_1.getTaskIdentifier)(plain)) !== null && _b !== void 0 ? _b : `#${taskId}`;
        commentSessions.set(userId, { taskId, identifier });
        try {
            await exports.bot.telegram.sendMessage(userId, `${messages_1.default.enterComment}. Задача: ${identifier}`);
        }
        catch (error) {
            commentSessions.delete(userId);
            console.error('Не удалось отправить запрос комментария', error);
            await ctx.answerCbQuery(messages_1.default.commentStartError, { show_alert: true });
            return;
        }
        await ctx.answerCbQuery(messages_1.default.commentPromptSent);
    }
    catch (error) {
        console.error('Не удалось подготовить ввод комментария', error);
        await ctx.answerCbQuery(messages_1.default.commentStartError, { show_alert: true });
    }
});
exports.bot.action('task_accept_prompt', async (ctx) => {
    await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});
exports.bot.action(/^task_accept_prompt:.+$/, async (ctx) => {
    var _a;
    const data = getCallbackData(ctx.callbackQuery);
    const taskId = getTaskIdFromCallback(data);
    if (!taskId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusInvalidId, {
            show_alert: true,
        });
        return;
    }
    const keyboard = (0, taskButtons_1.taskAcceptConfirmKeyboard)(taskId);
    await updateMessageReplyMarkup(ctx, (_a = keyboard.reply_markup) !== null && _a !== void 0 ? _a : undefined);
    await ctx.answerCbQuery(messages_1.default.taskStatusPrompt);
});
exports.bot.action('task_accept_confirm', async (ctx) => {
    await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});
exports.bot.action(/^task_accept_confirm:.+$/, async (ctx) => {
    var _a;
    const data = getCallbackData(ctx.callbackQuery);
    const taskId = getTaskIdFromCallback(data);
    if (!taskId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusInvalidId, {
            show_alert: true,
        });
        return;
    }
    const userId = (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusUnknownUser, {
            show_alert: true,
        });
        try {
            await refreshTaskKeyboard(ctx, taskId);
        }
        catch (error) {
            console.error('Не удалось обновить клавиатуру после неопределённого пользователя', error);
        }
        return;
    }
    const canUpdate = await ensureUserCanUpdateTask(ctx, taskId, userId, 'Не удалось получить задачу перед подтверждением');
    if (!canUpdate) {
        try {
            await refreshTaskKeyboard(ctx, taskId);
        }
        catch (error) {
            console.error('Не удалось восстановить клавиатуру после отмены подтверждения', error);
        }
        return;
    }
    await processStatusAction(ctx, 'В работе', messages_1.default.taskAccepted);
});
exports.bot.action('task_accept_cancel', async (ctx) => {
    await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});
exports.bot.action(/^task_accept_cancel:.+$/, async (ctx) => {
    const data = getCallbackData(ctx.callbackQuery);
    const taskId = getTaskIdFromCallback(data);
    if (!taskId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusInvalidId, {
            show_alert: true,
        });
        return;
    }
    try {
        await refreshTaskKeyboard(ctx, taskId);
    }
    catch (error) {
        console.error('Не удалось восстановить клавиатуру после отмены подтверждения', error);
    }
    await ctx.answerCbQuery(messages_1.default.taskStatusCanceled);
});
exports.bot.action('task_done', async (ctx) => {
    await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});
exports.bot.action('task_done_prompt', async (ctx) => {
    await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});
exports.bot.action(/^task_done_prompt:.+$/, async (ctx) => {
    var _a;
    const data = getCallbackData(ctx.callbackQuery);
    const taskId = getTaskIdFromCallback(data);
    if (!taskId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusInvalidId, {
            show_alert: true,
        });
        return;
    }
    const keyboard = (0, taskButtons_1.taskDoneConfirmKeyboard)(taskId);
    await updateMessageReplyMarkup(ctx, (_a = keyboard.reply_markup) !== null && _a !== void 0 ? _a : undefined);
    await ctx.answerCbQuery(messages_1.default.taskStatusPrompt);
});
exports.bot.action('task_done_confirm', async (ctx) => {
    await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});
exports.bot.action(/^task_done_confirm:.+$/, async (ctx) => {
    var _a;
    const data = getCallbackData(ctx.callbackQuery);
    const taskId = getTaskIdFromCallback(data);
    if (!taskId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusInvalidId, {
            show_alert: true,
        });
        return;
    }
    const userId = (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusUnknownUser, {
            show_alert: true,
        });
        try {
            await refreshTaskKeyboard(ctx, taskId);
        }
        catch (error) {
            console.error('Не удалось обновить клавиатуру после неопределённого пользователя', error);
        }
        return;
    }
    const canUpdate = await ensureUserCanUpdateTask(ctx, taskId, userId, 'Не удалось получить задачу перед завершением');
    if (!canUpdate) {
        try {
            await refreshTaskKeyboard(ctx, taskId);
        }
        catch (error) {
            console.error('Не удалось восстановить клавиатуру после отказа завершения', error);
        }
        return;
    }
    await processStatusAction(ctx, 'Выполнена', messages_1.default.taskCompleted);
});
exports.bot.action('task_done_cancel', async (ctx) => {
    await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});
exports.bot.action(/^task_done_cancel:.+$/, async (ctx) => {
    const data = getCallbackData(ctx.callbackQuery);
    const taskId = getTaskIdFromCallback(data);
    if (!taskId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusInvalidId, {
            show_alert: true,
        });
        return;
    }
    try {
        await refreshTaskKeyboard(ctx, taskId);
    }
    catch (error) {
        console.error('Не удалось восстановить клавиатуру после отмены завершения', error);
    }
    await ctx.answerCbQuery(messages_1.default.taskStatusCanceled);
});
exports.bot.action(/^task_done:.+$/, async (ctx) => {
    await processStatusAction(ctx, 'Выполнена', messages_1.default.taskCompleted);
});
exports.bot.action('task_cancel', async (ctx) => {
    await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});
exports.bot.action('task_cancel_prompt', async (ctx) => {
    await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});
exports.bot.action('task_cancel_request_prompt', async (ctx) => {
    await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});
exports.bot.action(/^task_cancel_request_prompt:.+$/, async (ctx) => {
    var _a;
    const data = getCallbackData(ctx.callbackQuery);
    const taskId = getTaskIdFromCallback(data);
    if (!taskId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusInvalidId, {
            show_alert: true,
        });
        return;
    }
    const userId = (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusUnknownUser, {
            show_alert: true,
        });
        return;
    }
    try {
        const context = await loadCancelRequestContext(taskId, userId);
        cancelRequestSessions.set(userId, {
            taskId,
            actorId: userId,
            identifier: context.identifier,
            stage: 'awaitingReason',
        });
        const promptText = `Введите причину отмены для задачи ${context.identifier}. Текст должен содержать не менее ${CANCEL_REASON_MIN_LENGTH} символов.`;
        const cancelRows = [
            [telegraf_1.Markup.button.callback('Отмена', `cancel_request_abort:${taskId}`)],
        ];
        const keyboard = telegraf_1.Markup.inlineKeyboard(cancelRows);
        if (!keyboard.reply_markup) {
            keyboard.reply_markup = { inline_keyboard: cancelRows };
        }
        try {
            await exports.bot.telegram.sendMessage(userId, promptText, {
                reply_markup: keyboard.reply_markup,
            });
        }
        catch (error) {
            cancelRequestSessions.delete(userId);
            console.error('Не удалось отправить запрос причины отмены', error);
            await ctx.answerCbQuery(messages_1.default.cancelRequestStartError, {
                show_alert: true,
            });
            return;
        }
        await ctx.answerCbQuery(messages_1.default.cancelRequestPrompt);
    }
    catch (error) {
        let response = messages_1.default.cancelRequestFailed;
        if (error instanceof CancellationRequestError) {
            switch (error.code) {
                case 'not_found':
                    response = messages_1.default.taskNotFound;
                    break;
                case 'not_executor':
                    response = messages_1.default.taskAssignmentRequired;
                    break;
                case 'creator_missing':
                    response = messages_1.default.cancelRequestCreatorMissing;
                    break;
                case 'unsupported':
                    response = messages_1.default.cancelRequestUnavailable;
                    break;
                default:
                    response = messages_1.default.cancelRequestFailed;
            }
        }
        else {
            console.error('Не удалось подготовить заявку на удаление', error);
        }
        await ctx.answerCbQuery(response, { show_alert: true });
    }
});
exports.bot.action(/^task_cancel_prompt:.+$/, async (ctx) => {
    var _a, _b;
    const data = getCallbackData(ctx.callbackQuery);
    const taskId = getTaskIdFromCallback(data);
    if (!taskId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusInvalidId, {
            show_alert: true,
        });
        return;
    }
    const userId = (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusUnknownUser, {
            show_alert: true,
        });
        return;
    }
    const context = await loadTaskContext(taskId);
    const plain = context.plain;
    if (!plain) {
        await denyCancellation(ctx, taskId);
        return;
    }
    const kind = detectTaskKind(plain);
    if (kind !== 'request') {
        await denyCancellation(ctx, taskId);
        return;
    }
    const isCreator = isTaskCreator(plain, userId);
    if (!isCreator && !isTaskExecutor(plain, userId)) {
        await denyCancellation(ctx, taskId, messages_1.default.requestCancelExecutorOnly);
        return;
    }
    const keyboard = (0, taskButtons_1.taskCancelConfirmKeyboard)(taskId);
    await updateMessageReplyMarkup(ctx, (_b = keyboard.reply_markup) !== null && _b !== void 0 ? _b : undefined);
    await ctx.answerCbQuery(messages_1.default.taskStatusPrompt);
});
exports.bot.action('task_cancel_confirm', async (ctx) => {
    await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});
exports.bot.action(/^task_cancel_confirm:.+$/, async (ctx) => {
    var _a;
    const data = getCallbackData(ctx.callbackQuery);
    const taskId = getTaskIdFromCallback(data);
    if (!taskId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusInvalidId, {
            show_alert: true,
        });
        return;
    }
    const userId = (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusUnknownUser, {
            show_alert: true,
        });
        return;
    }
    const canUpdate = await ensureUserCanUpdateTask(ctx, taskId, userId, 'Не удалось получить задачу перед отменой', { targetStatus: 'Отменена' });
    if (!canUpdate) {
        try {
            await refreshTaskKeyboard(ctx, taskId);
        }
        catch (error) {
            console.error('Не удалось восстановить клавиатуру после отказа отмены', error);
        }
        return;
    }
    await processStatusAction(ctx, 'Отменена', messages_1.default.taskCanceled);
});
exports.bot.action('task_cancel_cancel', async (ctx) => {
    await ctx.answerCbQuery('Некорректный формат кнопки', { show_alert: true });
});
exports.bot.action(/^task_cancel_cancel:.+$/, async (ctx) => {
    const data = getCallbackData(ctx.callbackQuery);
    const taskId = getTaskIdFromCallback(data);
    if (!taskId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusInvalidId, {
            show_alert: true,
        });
        return;
    }
    try {
        await refreshTaskKeyboard(ctx, taskId);
    }
    catch (error) {
        console.error('Не удалось восстановить клавиатуру после отмены действия', error);
    }
    await ctx.answerCbQuery(messages_1.default.taskStatusCanceled);
});
exports.bot.action(/^task_cancel:.+$/, async (ctx) => {
    var _a;
    const data = getCallbackData(ctx.callbackQuery);
    const taskId = getTaskIdFromCallback(data);
    if (!taskId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusInvalidId, {
            show_alert: true,
        });
        return;
    }
    const userId = (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusUnknownUser, {
            show_alert: true,
        });
        return;
    }
    const canUpdate = await ensureUserCanUpdateTask(ctx, taskId, userId, 'Не удалось получить задачу перед отменой', { targetStatus: 'Отменена' });
    if (!canUpdate) {
        try {
            await refreshTaskKeyboard(ctx, taskId);
        }
        catch (error) {
            console.error('Не удалось восстановить клавиатуру после отказа отмены', error);
        }
        return;
    }
    await processStatusAction(ctx, 'Отменена', messages_1.default.taskCanceled);
});
const registerTextHandler = (_a = exports.bot.on) === null || _a === void 0 ? void 0 : _a.bind(exports.bot);
if (!registerTextHandler) {
    console.warn('Метод bot.on недоступен, обработчик текстов не будет зарегистрирован');
}
else {
    registerTextHandler('text', async (ctx) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const userId = (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            return;
        }
        const commentSession = commentSessions.get(userId);
        if (commentSession) {
            if (((_b = ctx.chat) === null || _b === void 0 ? void 0 : _b.type) !== 'private') {
                return;
            }
            const messageText = typeof ((_c = ctx.message) === null || _c === void 0 ? void 0 : _c.text) === 'string' ? ctx.message.text : '';
            const normalizedComment = messageText.replace(/\r\n/g, '\n').trim();
            if (!normalizedComment) {
                await ctx.reply(messages_1.default.enterComment);
                return;
            }
            try {
                const task = await (0, service_1.getTask)(commentSession.taskId);
                if (!task) {
                    commentSessions.delete(userId);
                    await ctx.reply(messages_1.default.taskNotFound);
                    return;
                }
                const existing = Array.isArray(task.comments)
                    ? [...task.comments]
                    : [];
                const entry = {
                    author_id: userId,
                    text: normalizedComment,
                    created_at: new Date(),
                };
                const nextEntries = [...existing, entry];
                const authorIds = new Set();
                nextEntries.forEach((item) => {
                    const numeric = Number(item.author_id);
                    if (Number.isFinite(numeric)) {
                        authorIds.add(numeric);
                    }
                });
                const usersRaw = await (0, queries_1.getUsersMap)(Array.from(authorIds));
                const authorMeta = {};
                Object.entries(usersRaw !== null && usersRaw !== void 0 ? usersRaw : {}).forEach(([key, value]) => {
                    const numeric = Number(key);
                    if (!Number.isFinite(numeric)) {
                        return;
                    }
                    const name = typeof (value === null || value === void 0 ? void 0 : value.name) === 'string' && value.name.trim()
                        ? value.name.trim()
                        : undefined;
                    const username = typeof (value === null || value === void 0 ? void 0 : value.username) === 'string' && value.username.trim()
                        ? value.username.trim()
                        : undefined;
                    authorMeta[numeric] = { name, username };
                });
                const fallbackNames = {};
                const nameParts = [(_d = ctx.from) === null || _d === void 0 ? void 0 : _d.first_name, (_e = ctx.from) === null || _e === void 0 ? void 0 : _e.last_name]
                    .map((part) => (typeof part === 'string' ? part.trim() : ''))
                    .filter((part) => part.length > 0);
                const fallbackName = nameParts.join(' ').trim() ||
                    (((_f = ctx.from) === null || _f === void 0 ? void 0 : _f.username) ? `@${ctx.from.username}` : '') ||
                    String(userId);
                fallbackNames[userId] = fallbackName;
                const commentHtml = (0, taskComments_1.buildCommentHtml)(nextEntries, {
                    users: authorMeta,
                    fallbackNames,
                });
                const existingAttachments = Array.isArray(task.attachments)
                    ? task.attachments
                    : undefined;
                const commentAttachments = (0, attachments_1.buildAttachmentsFromCommentHtml)(commentHtml, {
                    existing: existingAttachments,
                });
                const updatePayload = {
                    comment: commentHtml,
                    comments: nextEntries,
                };
                if (commentAttachments.length > 0) {
                    updatePayload.attachments = commentAttachments;
                }
                const updated = await (0, service_1.updateTask)(commentSession.taskId, updatePayload, userId);
                if (!updated) {
                    commentSessions.delete(userId);
                    await ctx.reply(messages_1.default.taskNotFound);
                    return;
                }
                commentSessions.delete(userId);
                await ctx.reply(messages_1.default.commentSaved);
                await taskSyncController.syncAfterChange(commentSession.taskId, updated);
            }
            catch (error) {
                commentSessions.delete(userId);
                console.error('Не удалось сохранить комментарий задачи', error);
                await ctx.reply(messages_1.default.commentSaveError);
            }
            return;
        }
        const session = cancelRequestSessions.get(userId);
        if (!session || session.stage !== 'awaitingReason') {
            return;
        }
        if (((_g = ctx.chat) === null || _g === void 0 ? void 0 : _g.type) !== 'private') {
            return;
        }
        const messageText = typeof ((_h = ctx.message) === null || _h === void 0 ? void 0 : _h.text) === 'string' ? ctx.message.text : '';
        const normalized = messageText.replace(/\r\n/g, '\n').trim();
        if (!normalized || normalized.length < CANCEL_REASON_MIN_LENGTH) {
            await ctx.reply(messages_1.default.cancelRequestReasonLength);
            return;
        }
        session.reason = normalized;
        session.stage = 'awaitingConfirm';
        cancelRequestSessions.set(userId, session);
        const preview = normalized.length > 500 ? `${normalized.slice(0, 500)}…` : normalized;
        const confirmRows = [
            [
                telegraf_1.Markup.button.callback('Подтвердить', `cancel_request_confirm:${session.taskId}`),
                telegraf_1.Markup.button.callback('Отмена', `cancel_request_abort:${session.taskId}`),
            ],
        ];
        const keyboard = telegraf_1.Markup.inlineKeyboard(confirmRows);
        if (!keyboard.reply_markup) {
            keyboard.reply_markup = { inline_keyboard: confirmRows };
        }
        await ctx.reply(`${messages_1.default.cancelRequestConfirmPrompt}\n\nЗадача: ${session.identifier}\nПричина:\n${preview}`, {
            reply_markup: keyboard.reply_markup,
        });
    });
}
exports.bot.action(/^cancel_request_confirm:.+$/, async (ctx) => {
    var _a, _b;
    const data = getCallbackData(ctx.callbackQuery);
    const taskId = getTaskIdFromCallback(data);
    if (!taskId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusInvalidId, {
            show_alert: true,
        });
        return;
    }
    const userId = (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        await ctx.answerCbQuery(messages_1.default.taskStatusUnknownUser, {
            show_alert: true,
        });
        return;
    }
    const session = cancelRequestSessions.get(userId);
    if (!session || session.taskId !== taskId) {
        await ctx.answerCbQuery(messages_1.default.cancelRequestFailed, {
            show_alert: true,
        });
        return;
    }
    const reason = (_b = session.reason) === null || _b === void 0 ? void 0 : _b.trim();
    if (!reason || reason.length < CANCEL_REASON_MIN_LENGTH) {
        await ctx.answerCbQuery(messages_1.default.cancelRequestReasonLength, {
            show_alert: true,
        });
        return;
    }
    try {
        await createCancellationRequestFromTask(taskId, userId, reason);
        cancelRequestSessions.delete(userId);
        try {
            await ctx.editMessageReplyMarkup(undefined);
        }
        catch (error) {
            console.warn('Не удалось обновить сообщение подтверждения отмены', error);
        }
        await ctx.answerCbQuery(messages_1.default.cancelRequestSuccess);
        await ctx.reply(`${messages_1.default.cancelRequestSuccess}\nЗадача: ${session.identifier}`);
    }
    catch (error) {
        let response = messages_1.default.cancelRequestFailed;
        if (error instanceof CancellationRequestError) {
            switch (error.code) {
                case 'not_found':
                    response = messages_1.default.taskNotFound;
                    break;
                case 'not_executor':
                    response = messages_1.default.taskAssignmentRequired;
                    break;
                case 'creator_missing':
                    response = messages_1.default.cancelRequestCreatorMissing;
                    break;
                case 'unsupported':
                    response = messages_1.default.cancelRequestUnavailable;
                    break;
                default:
                    response = messages_1.default.cancelRequestFailed;
            }
        }
        else {
            console.error('Не удалось создать заявку на удаление задачи', error);
        }
        await ctx.answerCbQuery(response, { show_alert: true });
    }
});
exports.bot.action(/^cancel_request_abort:.+$/, async (ctx) => {
    var _a, _b;
    const data = getCallbackData(ctx.callbackQuery);
    const taskId = getTaskIdFromCallback(data);
    const userId = (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id;
    if (userId) {
        const session = cancelRequestSessions.get(userId);
        if (session && (!taskId || session.taskId === taskId)) {
            cancelRequestSessions.delete(userId);
        }
    }
    try {
        await ctx.editMessageReplyMarkup(undefined);
    }
    catch (error) {
        console.warn('Не удалось обновить сообщение отмены заявки', error);
    }
    await ctx.answerCbQuery(messages_1.default.cancelRequestCanceled);
    if (((_b = ctx.chat) === null || _b === void 0 ? void 0 : _b.type) === 'private') {
        await ctx.reply(messages_1.default.cancelRequestCanceled);
    }
});
const retryableCodes = new Set([409, 429, 502, 504]);
async function startBot(retry = 0) {
    var _a;
    try {
        await exports.bot.telegram.deleteWebhook({ drop_pending_updates: true });
        await exports.bot.launch({ dropPendingUpdates: true });
        console.log('Бот запущен');
    }
    catch (err) {
        const e = err;
        const code = (_a = e.response) === null || _a === void 0 ? void 0 : _a.error_code;
        const isConflict = code === 409;
        const isRateLimited = code === 429;
        const canRetry = retry < MAX_RETRIES || isConflict || isRateLimited;
        if (retryableCodes.has(code !== null && code !== void 0 ? code : 0) && canRetry) {
            if (isConflict) {
                console.warn('Обнаружен активный запрос getUpdates, сбрасываем предыдущую сессию');
                await resetLongPollingSession();
            }
            if (isRateLimited) {
                await waitForRetryAfter(err, 'Telegram вернул 429 при запуске бота');
            }
            console.error('Ошибка Telegram, повторная попытка запуска');
            const delay = 1000 * 2 ** retry;
            await sleep(delay);
            const nextRetry = isConflict || isRateLimited ? retry : retry + 1;
            return startBot(nextRetry);
        }
        console.error('Не удалось запустить бота:', err);
        throw err;
    }
    console.log(`Окружение: ${process.env.NODE_ENV || 'development'}, Node ${process.version}`);
}
process.once('SIGINT', () => exports.bot.stop('SIGINT'));
process.once('SIGTERM', () => exports.bot.stop('SIGTERM'));
const __resetCloseThrottleForTests = () => {
    if (process.env.NODE_ENV === 'test') {
        closeThrottleUntil = 0;
    }
};
exports.__resetCloseThrottleForTests = __resetCloseThrottleForTests;
