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
    const fromUser = req.user?.telegram_id;
    const userTelegramId = extractTelegramId(fromUser);
    if (userTelegramId)
        return userTelegramId;
    const body = req.body;
    const query = req.query;
    const params = req.params;
    const session = req.session;
    const candidates = [
        body?.telegramId,
        body?.telegram_id,
        query?.telegramId,
        query?.telegram_id,
        params?.telegramId,
        params?.telegram_id,
        session?.telegramId,
        session?.telegram_id,
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
        max: ((req) => req.user?.role === 'admin' && adminMax
            ? adminMax
            : max),
        keyGenerator: ((req) => {
            const telegramId = resolveTelegramId(req);
            const key = telegramId ?? (0, express_rate_limit_1.ipKeyGenerator)(req.ip);
            return `${name}:${key}`;
        }),
        standardHeaders: true,
        legacyHeaders: true,
        skip: ((req) => Boolean(req.user?.id) ||
            hasConfirmedHeader(req.headers['x-confirmed-action']) ||
            Boolean(captcha &&
                process.env.CAPTCHA_TOKEN &&
                req.headers['x-captcha-token'] === process.env.CAPTCHA_TOKEN)),
        handler: ((req, res) => {
            const info = req.rateLimit;
            const keyBase = resolveTelegramId(req) ?? (0, express_rate_limit_1.ipKeyGenerator)(req.ip);
            drops.inc({ name, key: keyBase });
            const reset = info?.resetTime;
            if (reset instanceof Date) {
                const retryAfter = Math.ceil((reset.getTime() - Date.now()) / 1000);
                res.setHeader('Retry-After', retryAfter.toString());
            }
            const limit = info?.limit;
            const remaining = info?.remaining;
            const resetTime = info?.resetTime instanceof Date
                ? Math.ceil(info.resetTime.getTime() / 1000)
                : info?.resetTime;
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
