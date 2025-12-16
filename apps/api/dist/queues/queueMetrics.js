"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startQueueMetricsPoller = void 0;
// Назначение: сбор метрик длины очередей BullMQ
// Основные модули: prom-client, BullMQ
const prom_client_1 = require("prom-client");
const shared_1 = require("shared");
const metrics_1 = require("../metrics");
const queue_1 = require("../config/queue");
const taskQueue_1 = require("./taskQueue");
const queueJobsGauge = new prom_client_1.Gauge({
    name: 'bullmq_jobs_total',
    help: 'Количество задач в очередях BullMQ по состояниям',
    labelNames: ['queue', 'state'],
    registers: [metrics_1.register],
});
const monitoredQueues = [
    shared_1.QueueName.LogisticsGeocoding,
    shared_1.QueueName.LogisticsRouting,
    shared_1.QueueName.DeadLetter,
];
const collectQueueCounts = async (queueName) => {
    var _a, _b, _c, _d, _e;
    const bundle = (0, taskQueue_1.getQueueBundle)(queueName);
    if (!bundle) {
        return;
    }
    const counts = await bundle.queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
    queueJobsGauge.set({ queue: queueName, state: 'waiting' }, (_a = counts.waiting) !== null && _a !== void 0 ? _a : 0);
    queueJobsGauge.set({ queue: queueName, state: 'active' }, (_b = counts.active) !== null && _b !== void 0 ? _b : 0);
    queueJobsGauge.set({ queue: queueName, state: 'delayed' }, (_c = counts.delayed) !== null && _c !== void 0 ? _c : 0);
    queueJobsGauge.set({ queue: queueName, state: 'failed' }, (_d = counts.failed) !== null && _d !== void 0 ? _d : 0);
    queueJobsGauge.set({ queue: queueName, state: 'completed' }, (_e = counts.completed) !== null && _e !== void 0 ? _e : 0);
};
let poller = null;
const startQueueMetricsPoller = () => {
    var _a;
    if (!queue_1.queueConfig.enabled || !queue_1.queueConfig.connection) {
        return;
    }
    if (poller) {
        return;
    }
    const collect = async () => {
        for (const queueName of monitoredQueues) {
            try {
                await collectQueueCounts(queueName);
            }
            catch (error) {
                console.error('Не удалось обновить метрики очереди', queueName, error);
            }
        }
    };
    void collect();
    poller = setInterval(() => {
        void collect();
    }, queue_1.queueConfig.metricsIntervalMs);
    (_a = poller.unref) === null || _a === void 0 ? void 0 : _a.call(poller);
};
exports.startQueueMetricsPoller = startQueueMetricsPoller;
