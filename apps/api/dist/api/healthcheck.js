"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkMongoHealth = checkMongoHealth;
exports.collectHealthStatus = collectHealthStatus;
exports.default = healthcheck;
const mongoose_1 = __importDefault(require("mongoose"));
const node_perf_hooks_1 = require("node:perf_hooks");
async function checkMongoHealth() {
    var _a;
    const { connection } = mongoose_1.default;
    if (connection.readyState !== 1) {
        return {
            status: 'down',
            message: `Состояние подключения: ${connection.readyState}`,
        };
    }
    const db = connection.db;
    if (!db) {
        return {
            status: 'down',
            message: 'Экземпляр базы данных недоступен',
        };
    }
    try {
        const start = node_perf_hooks_1.performance.now();
        await db.command({ ping: 1 });
        const duration = Math.round(node_perf_hooks_1.performance.now() - start);
        return {
            status: 'up',
            latencyMs: duration,
        };
    }
    catch (error) {
        const err = error;
        return {
            status: 'down',
            message: (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : 'Неизвестная ошибка MongoDB',
        };
    }
}
async function collectHealthStatus() {
    const mongo = await checkMongoHealth();
    const overall = mongo.status === 'up' ? 'ok' : 'error';
    return {
        status: overall,
        timestamp: new Date().toISOString(),
        checks: { mongo },
    };
}
async function healthcheck(_req, res) {
    const payload = await collectHealthStatus();
    const httpStatus = payload.status === 'ok' ? 200 : 503;
    res.status(httpStatus).json(payload);
}
