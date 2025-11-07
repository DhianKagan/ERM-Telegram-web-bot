"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = errorMiddleware;
const prom_client_1 = __importDefault(require("prom-client"));
const service_1 = require("../services/service");
const crypto_1 = require("crypto");
const problem_1 = require("../utils/problem");
const middleware_1 = require("../api/middleware");
const sanitizeError_1 = __importDefault(require("../utils/sanitizeError"));
const csrfErrors = new prom_client_1.default.Counter({
    name: 'csrf_errors_total',
    help: 'Количество ошибок CSRF',
});
function errorMiddleware(err, req, res, _next) {
    const error = err;
    const traceId = req.traceId || (0, crypto_1.randomUUID)();
    if (error.type === 'request.aborted') {
        const problem = {
            type: 'about:blank',
            title: 'Некорректный запрос',
            status: 400,
            detail: 'Клиент оборвал соединение',
        };
        (0, problem_1.sendProblem)(req, res, problem);
        middleware_1.apiErrors.inc({ method: req.method, path: req.originalUrl, status: 400 });
        return;
    }
    if (error.code === 'EBADCSRFTOKEN' || /CSRF token/.test(error.message)) {
        if (process.env.NODE_ENV !== 'test') {
            csrfErrors.inc();
            const header = req.headers['x-xsrf-token']
                ? String(req.headers['x-xsrf-token']).slice(0, 8)
                : 'none';
            const cookie = req.cookies && req.cookies['XSRF-TOKEN']
                ? String(req.cookies['XSRF-TOKEN']).slice(0, 8)
                : 'none';
            const uid = req.user ? `${req.user.id}/${req.user.username}` : 'anon';
            (0, service_1.writeLog)(`Ошибка CSRF-токена header:${header} cookie:${cookie} user:${uid} trace:${traceId} instance:${traceId}`).catch(() => { });
        }
        const problem = {
            type: 'about:blank',
            title: 'Ошибка CSRF',
            status: 403,
            detail: 'Токен недействителен или отсутствует. Обновите страницу и попробуйте ещё раз.',
        };
        (0, problem_1.sendProblem)(req, res, problem);
        middleware_1.apiErrors.inc({ method: req.method, path: req.originalUrl, status: 403 });
        return;
    }
    const clean = (0, sanitizeError_1.default)(error);
    console.error('API error:', clean);
    (0, service_1.writeLog)(`Ошибка ${clean} path:${req.originalUrl} ip:${req.ip} trace:${traceId} instance:${traceId}`, 'error').catch(() => { });
    const status = res.statusCode >= 400 ? res.statusCode : 500;
    const problem = {
        type: 'about:blank',
        title: 'Внутренняя ошибка',
        status,
        detail: error.message,
    };
    (0, problem_1.sendProblem)(req, res, problem);
    middleware_1.apiErrors.inc({ method: req.method, path: req.originalUrl, status });
}
