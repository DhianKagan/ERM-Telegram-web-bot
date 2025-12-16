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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createRateLimiter;
// Назначение файла: создание rate limiter с логированием и метриками
// Основные модули: express-rate-limit, prom-client, services/service
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
const service_1 = require("../services/service");
const problem_1 = require("../utils/problem");
const prom_client_1 = __importDefault(require("prom-client"));
const drops = new prom_client_1.default.Counter({
    name: 'rate_limit_drops_total',
    help: 'Количество отклонённых запросов лимитером',
    labelNames: ['name', 'key'],
});
function hasConfirmedHeader(value) {
    if (value === undefined || value === null) {
        return false;
    }
    if (Array.isArray(value)) {
        return value.some((item) => hasConfirmedHeader(item));
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value === 1;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    return false;
}
function extractTelegramId(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0)
            return trimmed;
    }
    return undefined;
}
function resolveTelegramId(req) {
    var _a;
    const fromUser = (_a = req.user) === null || _a === void 0 ? void 0 : _a.telegram_id;
    const userTelegramId = extractTelegramId(fromUser);
    if (userTelegramId)
        return userTelegramId;
    const body = req.body;
    const query = req.query;
    const params = req.params;
    const session = req.session;
    const candidates = [
        body === null || body === void 0 ? void 0 : body.telegramId,
        body === null || body === void 0 ? void 0 : body.telegram_id,
        query === null || query === void 0 ? void 0 : query.telegramId,
        query === null || query === void 0 ? void 0 : query.telegram_id,
        params === null || params === void 0 ? void 0 : params.telegramId,
        params === null || params === void 0 ? void 0 : params.telegram_id,
        session === null || session === void 0 ? void 0 : session.telegramId,
        session === null || session === void 0 ? void 0 : session.telegram_id,
    ];
    for (const candidate of candidates) {
        const id = extractTelegramId(candidate);
        if (id)
            return id;
    }
    return undefined;
}
function createRateLimiter({ windowMs, max, name, adminMax, captcha, }) {
    return (0, express_rate_limit_1.default)({
        windowMs,
        max: ((req) => {
            var _a;
            return ((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) === 'admin' && adminMax
                ? adminMax
                : max;
        }),
        keyGenerator: ((req) => {
            const telegramId = resolveTelegramId(req);
            const key = telegramId !== null && telegramId !== void 0 ? telegramId : (0, express_rate_limit_1.ipKeyGenerator)(req.ip);
            return `${name}:${key}`;
        }),
        standardHeaders: true,
        legacyHeaders: true,
        skip: ((req) => {
            var _a;
            return Boolean((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) ||
                hasConfirmedHeader(req.headers['x-confirmed-action']) ||
                Boolean(captcha &&
                    process.env.CAPTCHA_TOKEN &&
                    req.headers['x-captcha-token'] === process.env.CAPTCHA_TOKEN);
        }),
        handler: ((req, res) => {
            var _a;
            const info = req.rateLimit;
            const keyBase = (_a = resolveTelegramId(req)) !== null && _a !== void 0 ? _a : (0, express_rate_limit_1.ipKeyGenerator)(req.ip);
            drops.inc({ name, key: keyBase });
            const reset = info === null || info === void 0 ? void 0 : info.resetTime;
            if (reset instanceof Date) {
                const retryAfter = Math.ceil((reset.getTime() - Date.now()) / 1000);
                res.setHeader('Retry-After', retryAfter.toString());
            }
            const limit = info === null || info === void 0 ? void 0 : info.limit;
            const remaining = info === null || info === void 0 ? void 0 : info.remaining;
            const resetTime = (info === null || info === void 0 ? void 0 : info.resetTime) instanceof Date
                ? Math.ceil(info.resetTime.getTime() / 1000)
                : info === null || info === void 0 ? void 0 : info.resetTime;
            if (limit !== undefined)
                res.setHeader('X-RateLimit-Limit', limit.toString());
            if (remaining !== undefined)
                res.setHeader('X-RateLimit-Remaining', remaining.toString());
            if (resetTime !== undefined)
                res.setHeader('X-RateLimit-Reset', resetTime.toString());
            (0, service_1.writeLog)(`Превышен лимит ${req.method} ${req.originalUrl} key:${keyBase} ` +
                `limit:${limit} remaining:${remaining} reset:${resetTime}`, 'warn').catch(() => { });
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Превышен лимит запросов',
                status: 429,
                detail: 'Слишком много запросов, попробуйте позже.',
            });
        }),
    });
}
