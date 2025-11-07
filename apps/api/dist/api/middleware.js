"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.apiErrors = void 0;
exports.verifyToken = verifyToken;
exports.requestLogger = requestLogger;
// Middleware проверки JWT и вспомогательные функции.
// Модули: jsonwebtoken, config
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const service_1 = require("../services/service");
const config_1 = __importDefault(require("../config"));
const shouldLog_1 = __importDefault(require("../utils/shouldLog"));
const prom_client_1 = __importDefault(require("prom-client"));
exports.apiErrors = new prom_client_1.default.Counter({
    name: 'api_errors_total',
    help: 'Количество ошибок API',
    labelNames: ['method', 'path', 'status'],
});
const asyncHandler = (fn) => {
    return async (req, res, next) => {
        try {
            await fn(req, res, next);
        }
        catch (e) {
            next(e);
        }
    };
};
exports.asyncHandler = asyncHandler;
const { jwtSecret } = config_1.default;
// Строго задаём тип секретного ключа JWT
const secretKey = jwtSecret || '';
function sendAuthProblem(res, status, detail) {
    const payload = {
        type: 'about:blank',
        title: 'Ошибка авторизации',
        status,
        detail,
    };
    res
        .status(status)
        .type('application/problem+json')
        .send(JSON.stringify(payload));
}
function verifyToken(req, res, next) {
    const auth = req.headers['authorization'];
    let token;
    let fromHeader = false;
    if (auth) {
        if (auth.startsWith('Bearer ')) {
            token = auth.slice(7).trim();
            if (!token) {
                (0, service_1.writeLog)(`Неверный формат токена ${req.method} ${req.originalUrl} ip:${req.ip}`).catch(() => { });
                exports.apiErrors.inc({
                    method: req.method,
                    path: req.originalUrl,
                    status: 403,
                });
                sendAuthProblem(res, 403, 'Заголовок авторизации не содержит токен после Bearer.');
                return;
            }
            fromHeader = true;
        }
        else if (auth.includes(' ')) {
            const part = auth.slice(0, 8);
            (0, service_1.writeLog)(`Неверный формат токена ${part} ip:${req.ip}`).catch(() => { });
            exports.apiErrors.inc({ method: req.method, path: req.originalUrl, status: 403 });
            sendAuthProblem(res, 403, 'Заголовок авторизации содержит недопустимые пробелы.');
            return;
        }
        else {
            token = auth;
            fromHeader = true;
        }
    }
    else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }
    else {
        (0, service_1.writeLog)(`Отсутствует токен ${req.method} ${req.originalUrl} ip:${req.ip}`).catch(() => { });
        exports.apiErrors.inc({ method: req.method, path: req.originalUrl, status: 401 });
        sendAuthProblem(res, 401, 'Токен авторизации отсутствует.');
        return;
    }
    const preview = token ? String(token).slice(0, 8) : 'none';
    jsonwebtoken_1.default.verify(token, secretKey, { algorithms: ['HS256'] }, (err, decoded) => {
        if (err) {
            (0, service_1.writeLog)(`Неверный токен ${preview} ip:${req.ip}`).catch(() => { });
            exports.apiErrors.inc({
                method: req.method,
                path: req.originalUrl,
                status: 401,
            });
            sendAuthProblem(res, 401, 'Токен авторизации недействителен или использует неподдерживаемый алгоритм.');
            return;
        }
        req.user = decoded;
        const cookieOpts = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        };
        if (cookieOpts.secure) {
            cookieOpts.domain =
                config_1.default.cookieDomain || new URL(config_1.default.appUrl).hostname;
        }
        if (!fromHeader) {
            res.cookie('token', token, cookieOpts);
        }
        next();
    });
}
function requestLogger(req, res, next) {
    if (!(0, shouldLog_1.default)(req)) {
        return next();
    }
    const traceId = req.traceId;
    const { method, originalUrl, headers, cookies, ip } = req;
    const tokenVal = cookies && cookies.token
        ? cookies.token.slice(0, 8)
        : 'no-token';
    const csrfVal = headers['x-xsrf-token']
        ? String(headers['x-xsrf-token']).slice(0, 8)
        : 'no-csrf';
    const auth = headers.authorization;
    let authVal = 'no-auth';
    if (auth) {
        authVal = auth.startsWith('Bearer ') ? auth.slice(7, 15) : auth.slice(0, 8);
    }
    const ua = headers['user-agent']
        ? String(headers['user-agent']).slice(0, 40)
        : 'unknown';
    (0, service_1.writeLog)(`API запрос ${method} ${originalUrl} trace:${traceId} token:${tokenVal} auth:${authVal} csrf:${csrfVal} ip:${ip} ua:${ua}`).catch(() => { });
    res.on('finish', () => {
        (0, service_1.writeLog)(`API ответ ${method} ${originalUrl} ${res.statusCode} trace:${traceId} ip:${ip}`).catch(() => { });
    });
    next();
}
exports.default = { verifyToken, asyncHandler: exports.asyncHandler, requestLogger, apiErrors: exports.apiErrors };
