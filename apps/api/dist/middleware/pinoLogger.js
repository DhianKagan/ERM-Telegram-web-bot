"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
const pino_http_1 = __importDefault(require("pino-http"));
const wgLogEngine_1 = require("../services/wgLogEngine");
const httpLogger = wgLogEngine_1.logger.child({ component: 'http' });
const middleware = (0, pino_http_1.default)({
    logger: httpLogger,
    genReqId: (req) => {
        const header = req.headers['traceparent'];
        if (typeof header === 'string') {
            const [, traceId, spanId] = header.split('-');
            if (traceId && spanId)
                return `${traceId}-${spanId}`;
        }
        return (0, node_crypto_1.randomUUID)();
    },
    customProps: (req) => ({
        ip: req.ip,
        ua: req.headers['user-agent'],
        method: req.method,
        path: req.originalUrl,
    }),
    customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500)
            return 'error';
        if (res.statusCode >= 400)
            return 'warn';
        return 'info';
    },
    customSuccessMessage: (_req, res) => `HTTP ${res.statusCode}`,
    customErrorMessage: (_req, res, err) => `HTTP ${res.statusCode}: ${err.message}`,
});
exports.default = middleware;
