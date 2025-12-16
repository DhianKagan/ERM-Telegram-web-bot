"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tsyringe_1 = require("tsyringe");
const shared_1 = require("shared");
const stackHealth_service_1 = __importDefault(require("./stackHealth.service"));
const tokens_1 = require("../di/tokens");
const pickEnv = (keys) => {
    for (const key of keys) {
        const value = process.env[key];
        if (value && value.trim()) {
            return value.trim();
        }
    }
    return undefined;
};
const normalizeBaseUrl = (value) => {
    if (!value)
        return undefined;
    try {
        const parsed = new URL(value);
        parsed.search = '';
        parsed.hash = '';
        const cleaned = parsed.toString();
        return cleaned.endsWith('/') ? cleaned.slice(0, -1) : cleaned;
    }
    catch {
        return undefined;
    }
};
const deriveProxyFromEnv = (raw, source) => {
    const normalized = normalizeBaseUrl(raw);
    if (!normalized) {
        return {};
    }
    try {
        const parsed = new URL(normalized);
        const segments = parsed.pathname.split('/').filter(Boolean);
        if (segments.length === 0) {
            return { url: parsed.origin, source };
        }
        segments.pop();
        parsed.pathname = segments.length ? `/${segments.join('/')}` : '/';
        const base = parsed.toString();
        return {
            url: base.endsWith('/') ? base.slice(0, -1) : base,
            source,
        };
    }
    catch {
        return {};
    }
};
const selectProxyUrl = () => {
    var _a;
    const directCandidates = [
        { value: process.env.PROXY_PRIVATE_URL, source: 'PROXY_PRIVATE_URL' },
        { value: process.env.GEOCODER_PROXY_URL, source: 'GEOCODER_PROXY_URL' },
    ];
    for (const candidate of directCandidates) {
        const normalized = normalizeBaseUrl((_a = candidate.value) === null || _a === void 0 ? void 0 : _a.trim());
        if (normalized) {
            return { url: normalized, source: candidate.source };
        }
    }
    const geocoder = deriveProxyFromEnv(process.env.GEOCODER_URL, 'GEOCODER_URL');
    if (geocoder.url) {
        return geocoder;
    }
    return deriveProxyFromEnv(process.env.ROUTING_URL, 'ROUTING_URL');
};
let StackHealthController = class StackHealthController {
    constructor(service) {
        this.service = service;
        this.run = async (_req, res) => {
            const proxy = selectProxyUrl();
            const proxyToken = pickEnv(['PROXY_TOKEN', 'GEOCODER_PROXY_TOKEN']);
            const redisUrl = pickEnv(['QUEUE_REDIS_URL', 'REDIS_URL']);
            const queuePrefix = pickEnv(['QUEUE_PREFIX']);
            const queueNamesRaw = pickEnv(['HEALTH_QUEUE_NAMES']);
            const knownQueueNames = new Set(Object.values(shared_1.QueueName));
            const report = await this.service.run({
                proxyUrl: proxy.url,
                proxySource: proxy.source,
                proxyToken,
                redisUrl,
                queuePrefix,
                queueNames: queueNamesRaw
                    ? queueNamesRaw
                        .split(',')
                        .map((value) => value.trim())
                        .filter((value) => knownQueueNames.has(value))
                    : undefined,
            });
            res.json(report);
        };
    }
};
StackHealthController = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.StackHealthService)),
    __metadata("design:paramtypes", [stackHealth_service_1.default])
], StackHealthController);
exports.default = StackHealthController;
