"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = errorMiddleware;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sanitizeError_1 = __importDefault(require("../utils/sanitizeError"));
const service_1 = require("../services/service");
const LOG_DIR = path_1.default.join(process.cwd(), 'logs');
const ERROR_LOG_FILE = path_1.default.join(LOG_DIR, 'error.log');
const PROBLEM_CONTENT_TYPE = 'application/problem+json';
function ensureLogDir() {
    if (!fs_1.default.existsSync(LOG_DIR)) {
        fs_1.default.mkdirSync(LOG_DIR, { recursive: true });
    }
}
function appendErrorLog(entry) {
    try {
        ensureLogDir();
        fs_1.default.appendFileSync(ERROR_LOG_FILE, entry + '\n', { encoding: 'utf8' });
    }
    catch (e) {
        console.error('Не удалось записать в error.log:', e);
    }
}
function isRequestAborted(err, req) {
    if (req.aborted) {
        return true;
    }
    if (!err || typeof err !== 'object') {
        return false;
    }
    const candidate = err;
    const type = typeof candidate.type === 'string' ? candidate.type : '';
    if (type === 'request.aborted') {
        return true;
    }
    const name = typeof candidate.name === 'string' ? candidate.name : '';
    if (/AbortError/i.test(name)) {
        return true;
    }
    const message = typeof candidate.message === 'string' ? candidate.message : '';
    return /aborted/i.test(message);
}
function isCsrfError(err) {
    if (!err || typeof err !== 'object') {
        return false;
    }
    const candidate = err;
    const code = typeof candidate.code === 'string' ? candidate.code : '';
    if (code === 'EBADCSRFTOKEN') {
        return true;
    }
    const type = typeof candidate.type === 'string' ? candidate.type : '';
    if (type === 'EBADCSRFTOKEN') {
        return true;
    }
    const name = typeof candidate.name === 'string' ? candidate.name : '';
    const message = typeof candidate.message === 'string' ? candidate.message : '';
    return /csrf/i.test(name) || /csrf/i.test(message);
}
function resolveStatus(err, aborted, csrf, currentStatus) {
    if (aborted) {
        return 400;
    }
    if (csrf) {
        return 403;
    }
    if (err && typeof err === 'object') {
        const candidate = err;
        if (typeof candidate.status === 'number' &&
            Number.isFinite(candidate.status)) {
            return candidate.status;
        }
        if (typeof candidate.statusCode === 'number' &&
            Number.isFinite(candidate.statusCode)) {
            return candidate.statusCode;
        }
    }
    if (typeof currentStatus === 'number' &&
        Number.isFinite(currentStatus) &&
        currentStatus >= 400) {
        return currentStatus;
    }
    return 500;
}
function resolveTitle(status, aborted, csrf) {
    if (csrf) {
        return 'Ошибка CSRF';
    }
    if (aborted) {
        return 'Некорректный запрос';
    }
    if (status >= 500) {
        return 'Ошибка сервера';
    }
    return 'Некорректный запрос';
}
function buildProblem(status, title, detail, instance, traceId) {
    const result = {
        type: 'about:blank',
        title,
        status,
        instance,
    };
    if (detail) {
        result.detail = detail;
    }
    if (traceId) {
        result.traceId = traceId;
    }
    return result;
}
function getRequestBody(req) {
    try {
        return JSON.stringify(req.body);
    }
    catch {
        return String(req.body);
    }
}
function getStack(err, fallback) {
    if (err instanceof Error && typeof err.stack === 'string') {
        return err.stack;
    }
    return fallback;
}
function errorMiddleware(err, req, res, _next) {
    var _a;
    void _next;
    const aborted = isRequestAborted(err, req);
    const csrfError = isCsrfError(err);
    const status = resolveStatus(err, aborted, csrfError, res.statusCode);
    const clean = (0, sanitizeError_1.default)(err);
    const traceId = (res.locals && (res.locals.traceId || res.locals.trace)) || undefined;
    const userId = (res.locals && res.locals.user && res.locals.user.id) || undefined;
    const time = new Date().toISOString();
    const method = req.method;
    const url = req.originalUrl || req.url;
    const ip = req.ip ||
        (req.connection && 'remoteAddress' in req.connection
            ? String((_a = req.connection.remoteAddress) !== null && _a !== void 0 ? _a : '')
            : undefined);
    const body = getRequestBody(req);
    const stack = getStack(err, clean);
    const logObject = {
        time,
        traceId: traceId !== null && traceId !== void 0 ? traceId : null,
        method,
        url,
        ip: ip !== null && ip !== void 0 ? ip : null,
        userId: userId !== null && userId !== void 0 ? userId : null,
        clean,
        body,
        headers: {
            origin: req.headers.origin,
            referer: req.headers.referer,
            'user-agent': req.headers['user-agent'],
        },
    };
    appendErrorLog(JSON.stringify(logObject));
    appendErrorLog('--- ' +
        time +
        ' ' +
        method +
        ' ' +
        url +
        ' trace:' +
        (traceId !== null && traceId !== void 0 ? traceId : '-') +
        ' user:' +
        (userId !== null && userId !== void 0 ? userId : '-') +
        ' ip:' +
        (ip !== null && ip !== void 0 ? ip : '-') +
        ' ---');
    appendErrorLog(stack);
    appendErrorLog('');
    console.error('API error:', clean);
    try {
        (0, service_1.writeLog)('Ошибка ' +
            clean +
            ' path:' +
            url +
            ' ip:' +
            (ip !== null && ip !== void 0 ? ip : '-') +
            ' trace:' +
            (traceId !== null && traceId !== void 0 ? traceId : '-'), 'error');
    }
    catch (writeErr) {
        console.error('writeLog error:', writeErr);
    }
    if (res.headersSent) {
        return;
    }
    const detail = aborted ? 'request aborted' : clean;
    const title = resolveTitle(status, aborted, csrfError);
    const instance = req.originalUrl || req.url || req.path || '/';
    const problem = buildProblem(status, title, detail, instance, traceId);
    try {
        res.type(PROBLEM_CONTENT_TYPE);
    }
    catch (typeErr) {
        console.error('Не удалось выставить content-type для ошибки:', typeErr);
    }
    res.status(problem.status).json(problem);
}
