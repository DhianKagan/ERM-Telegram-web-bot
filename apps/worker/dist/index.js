"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// apps/worker/src/index.ts
// Запуск воркеров BullMQ: геокодирование и маршрутизация
const bullmq_1 = require("bullmq");
const shared_1 = require("shared");
const config_1 = require("./config");
const logger_1 = require("./logger");
const geocoding_1 = require("./tasks/geocoding");
const routing_1 = require("./tasks/routing");
process.on('unhandledRejection', (reason) => {
    logger_1.logger.error({ reason }, 'Unhandled rejection in worker process');
    process.exit(1);
});
process.on('uncaughtException', (error) => {
    logger_1.logger.error({ error }, 'Uncaught exception in worker process');
    process.exit(1);
});
const baseQueueOptions = {
    connection: config_1.workerConfig.connection,
    prefix: config_1.workerConfig.prefix,
};
const deadLetterQueue = new bullmq_1.Queue(shared_1.QueueName.DeadLetter, {
    ...baseQueueOptions,
    defaultJobOptions: { removeOnComplete: false, removeOnFail: false },
});
const forwardToDlq = async (job, error) => {
    var _a;
    if (!job)
        return;
    const payload = {
        queue: job.queueName,
        jobName: job.name,
        payload: job.data,
        failedReason: error ? error.message : 'unknown',
        attemptsMade: (_a = job.attemptsMade) !== null && _a !== void 0 ? _a : 0,
        failedAt: Date.now(),
    };
    await deadLetterQueue.add(shared_1.QueueJobName.DeadLetter, payload, {
        removeOnComplete: false,
        removeOnFail: false,
    });
};
const geocodingWorker = new bullmq_1.Worker(shared_1.QueueName.LogisticsGeocoding, 
// Processor: pass the whole Job to geocodeAddress for maximum flexibility
async (job) => {
    // geocodeAddress expects Job or address; we pass job so it can read taskId, address etc.
    return (0, geocoding_1.geocodeAddress)(job);
}, {
    ...baseQueueOptions,
    concurrency: config_1.workerConfig.concurrency,
});
const routingWorker = new bullmq_1.Worker(shared_1.QueueName.LogisticsRouting, async (job) => {
    // Preserve optional traceparent propagation from job.data
    const traceparent = typeof job.data === 'object' && job.data !== null && 'traceparent' in job.data
        ? job.data.traceparent
        : undefined;
    // Build routing config including traceparent if provided
    const routingConfigWithTrace = {
        ...config_1.workerConfig.routing,
        ...(typeof traceparent === 'string' ? { traceparent } : {}),
    };
    return (0, routing_1.calculateRouteDistance)(job.data.start, job.data.finish, routingConfigWithTrace);
}, {
    ...baseQueueOptions,
    concurrency: config_1.workerConfig.concurrency,
});
const handleFailure = (workerName, job, error) => {
    logger_1.logger.error({ jobId: job === null || job === void 0 ? void 0 : job.id, queue: job === null || job === void 0 ? void 0 : job.queueName, error }, `${workerName} failed`);
    void forwardToDlq(job, error).catch((dlqError) => {
        logger_1.logger.error({ dlqError }, 'Failed to forward job to DLQ');
    });
};
geocodingWorker.on('failed', (job, error) => handleFailure('Geocoder', job, error));
routingWorker.on('failed', (job, error) => handleFailure('Router', job, error));
const shutdown = async () => {
    logger_1.logger.info('Shutting down BullMQ workers...');
    await Promise.all([
        geocodingWorker.close(),
        routingWorker.close(),
        deadLetterQueue.close(),
    ]);
    logger_1.logger.info('Workers stopped');
    process.exit(0);
};
process.on('SIGINT', () => {
    void shutdown();
});
process.on('SIGTERM', () => {
    void shutdown();
});
logger_1.logger.info({
    prefix: config_1.workerConfig.prefix,
    attempts: config_1.workerConfig.attempts,
    backoffMs: config_1.workerConfig.backoffMs,
    concurrency: config_1.workerConfig.concurrency,
}, 'BullMQ workers started');
