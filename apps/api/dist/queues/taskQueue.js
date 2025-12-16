"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestRouteDistanceJob = exports.requestGeocodingJob = exports.getQueueBundle = void 0;
// apps/api/src/queues/taskQueue.ts
// Назначение: постановка задач в очереди BullMQ и ожидание результатов
const bullmq_1 = require("bullmq");
const shared_1 = require("shared");
const geocoder_1 = require("../geo/geocoder");
const osrm_1 = require("../geo/osrm");
const queue_1 = require("../config/queue");
const bundles = new Map();
const buildJobOptions = () => ({
    attempts: queue_1.queueConfig.attempts,
    backoff: { type: 'exponential', delay: queue_1.queueConfig.backoffMs },
    removeOnComplete: true,
    removeOnFail: false,
});
const createQueueBundle = (queueName) => {
    if (!queue_1.queueConfig.enabled || !queue_1.queueConfig.connection) {
        return null;
    }
    const options = {
        connection: queue_1.queueConfig.connection,
        prefix: queue_1.queueConfig.prefix,
    };
    const queue = new bullmq_1.Queue(queueName, {
        ...options,
        defaultJobOptions: buildJobOptions(),
    });
    const events = new bullmq_1.QueueEvents(queueName, options);
    events.on('error', (error) => {
        console.error('События очереди BullMQ недоступны', error);
    });
    return { queue, events };
};
const getQueueBundle = (queueName) => {
    const existing = bundles.get(queueName);
    if (existing) {
        return existing;
    }
    const created = createQueueBundle(queueName);
    if (created) {
        bundles.set(queueName, created);
    }
    return created;
};
exports.getQueueBundle = getQueueBundle;
const waitForResult = async (job, events, fallback) => {
    try {
        const result = await job.waitUntilFinished(events, queue_1.queueConfig.jobTimeoutMs);
        return result;
    }
    catch (error) {
        console.error('Не удалось дождаться результата задачи BullMQ', error);
        return fallback();
    }
};
const requestGeocodingJob = async (address) => {
    const bundle = (0, exports.getQueueBundle)(shared_1.QueueName.LogisticsGeocoding);
    if (!bundle) {
        return (0, geocoder_1.geocodeAddress)(address);
    }
    try {
        const job = await bundle.queue.add(shared_1.QueueJobName.GeocodeAddress, {
            address,
        });
        return waitForResult(job, bundle.events, () => (0, geocoder_1.geocodeAddress)(address));
    }
    catch (error) {
        console.error('Постановка задачи геокодирования в очередь не удалась', error);
        return (0, geocoder_1.geocodeAddress)(address);
    }
};
exports.requestGeocodingJob = requestGeocodingJob;
const requestRouteDistanceJob = async (params, context) => {
    const bundle = (0, exports.getQueueBundle)(shared_1.QueueName.LogisticsRouting);
    if (!bundle) {
        // synchronous fallback to local OSRM/ORS call
        const distanceKm = await (0, osrm_1.getOsrmDistance)(params);
        return { distanceKm };
    }
    try {
        // include traceparent in job data so worker can propagate it
        const jobPayload = { ...params, ...((context === null || context === void 0 ? void 0 : context.traceparent) ? { traceparent: context.traceparent } : {}) };
        const job = await bundle.queue.add(shared_1.QueueJobName.RouteDistance, jobPayload);
        return waitForResult(job, bundle.events, async () => {
            const distanceKm = await (0, osrm_1.getOsrmDistance)(params);
            return { distanceKm };
        });
    }
    catch (error) {
        console.error('Постановка расчёта маршрута в очередь не удалась', error);
        const distanceKm = await (0, osrm_1.getOsrmDistance)(params);
        return { distanceKm };
    }
};
exports.requestRouteDistanceJob = requestRouteDistanceJob;
