"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.fleetRecoveryFailuresTotal = exports.osrmErrorsTotal = exports.osrmRequestDuration = exports.httpRequestDuration = exports.httpRequestsTotal = exports.register = void 0;
// Назначение: единый реестр Prometheus-метрик
// Основные модули: prom-client
const prom_client_1 = __importDefault(require("prom-client"));
const globalKey = Symbol.for('erm.metrics.register');
const globalSymbols = globalThis;
exports.register = globalSymbols[globalKey] ||
    (globalSymbols[globalKey] = new prom_client_1.default.Registry());
const isJest = typeof process !== 'undefined' &&
    (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined);
let defaultMetricsInterval;
if (!isJest) {
    defaultMetricsInterval = prom_client_1.default.collectDefaultMetrics({ register: exports.register });
    (_a = defaultMetricsInterval === null || defaultMetricsInterval === void 0 ? void 0 : defaultMetricsInterval.unref) === null || _a === void 0 ? void 0 : _a.call(defaultMetricsInterval);
}
exports.httpRequestsTotal = new prom_client_1.default.Counter({
    name: 'http_requests_total',
    help: 'Количество HTTP запросов',
    labelNames: ['method', 'route', 'status'],
    registers: [exports.register],
});
exports.httpRequestDuration = new prom_client_1.default.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Длительность HTTP запросов в секундах',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 3, 5],
    registers: [exports.register],
});
exports.osrmRequestDuration = new prom_client_1.default.Histogram({
    name: 'osrm_request_duration_seconds',
    help: 'Длительность запросов к OSRM',
    labelNames: ['endpoint', 'status'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 3, 5],
    registers: [exports.register],
});
exports.osrmErrorsTotal = new prom_client_1.default.Counter({
    name: 'osrm_errors_total',
    help: 'Ошибки запросов к OSRM',
    labelNames: ['endpoint', 'reason'],
    registers: [exports.register],
});
exports.fleetRecoveryFailuresTotal = new prom_client_1.default.Counter({
    name: 'fleet_recovery_failures_total',
    help: 'Неудачные попытки восстановления флота из коллекции',
    labelNames: ['reason'],
    registers: [exports.register],
});
