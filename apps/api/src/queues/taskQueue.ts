// apps/api/src/queues/taskQueue.ts
// Назначение: постановка задач в очереди BullMQ и ожидание результатов
import { Queue, QueueEvents, type JobsOptions, type Job } from 'bullmq';
import {
  QueueJobName,
  QueueName,
  type Coordinates,
  type GeocodingJobResult,
  type RouteDistanceJobResult,
} from 'shared';
import { geocodeAddress } from '../geo/geocoder';
import { getOsrmDistance } from '../geo/osrm';
import { queueConfig } from '../config/queue';

type QueueBundle = {
  queue: Queue;
  events: QueueEvents;
};

const bundles = new Map<QueueName, QueueBundle>();

const buildJobOptions = (): JobsOptions => ({
  attempts: queueConfig.attempts,
  backoff: { type: 'exponential', delay: queueConfig.backoffMs },
  removeOnComplete: true,
  removeOnFail: false,
});

const createQueueBundle = (queueName: QueueName): QueueBundle | null => {
  if (!queueConfig.enabled || !queueConfig.connection) {
    return null;
  }

  const options = {
    connection: queueConfig.connection,
    prefix: queueConfig.prefix,
  } as const;

  const queue = new Queue(queueName, {
    ...options,
    defaultJobOptions: buildJobOptions(),
  });

  const events = new QueueEvents(queueName, options);
  events.on('error', (error) => {
    console.error('События очереди BullMQ недоступны', error);
  });

  return { queue, events } satisfies QueueBundle;
};

export const getQueueBundle = (queueName: QueueName): QueueBundle | null => {
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

const waitForResult = async <T>(
  job: Job,
  events: QueueEvents,
  fallback: () => Promise<T>,
): Promise<T> => {
  try {
    const result = await job.waitUntilFinished(events, queueConfig.jobTimeoutMs);
    return result as T;
  } catch (error) {
    console.error('Не удалось дождаться результата задачи BullMQ', error);
    return fallback();
  }
};

export const requestGeocodingJob = async (
  address: string,
): Promise<GeocodingJobResult> => {
  const bundle = getQueueBundle(QueueName.LogisticsGeocoding);
  if (!bundle) {
    return geocodeAddress(address);
  }

  try {
    const job = await bundle.queue.add(QueueJobName.GeocodeAddress, {
      address,
    });
    return waitForResult<GeocodingJobResult>(job, bundle.events, () =>
      geocodeAddress(address),
    );
  } catch (error) {
    console.error(
      'Постановка задачи геокодирования в очередь не удалась',
      error,
    );
    return geocodeAddress(address);
  }
};

export type RequestRouteDistanceParams = {
  start: Coordinates;
  finish: Coordinates;
};

export type RequestRouteDistanceContext = {
  traceparent?: string;
};

export const requestRouteDistanceJob = async (
  params: RequestRouteDistanceParams,
  context?: RequestRouteDistanceContext,
): Promise<RouteDistanceJobResult> => {
  const bundle = getQueueBundle(QueueName.LogisticsRouting);
  if (!bundle) {
    // synchronous fallback to local OSRM/ORS call
    const distanceKm = await getOsrmDistance(params);
    return { distanceKm } satisfies RouteDistanceJobResult;
  }

  try {
    // include traceparent in job data so worker can propagate it
    const jobPayload = { ...params, ...(context?.traceparent ? { traceparent: context.traceparent } : {}) };
    const job = await bundle.queue.add(QueueJobName.RouteDistance, jobPayload);
    return waitForResult<RouteDistanceJobResult>(
      job,
      bundle.events,
      async () => {
        const distanceKm = await getOsrmDistance(params);
        return { distanceKm } satisfies RouteDistanceJobResult;
      },
    );
  } catch (error) {
    console.error('Постановка расчёта маршрута в очередь не удалась', error);
    const distanceKm = await getOsrmDistance(params);
    return { distanceKm } satisfies RouteDistanceJobResult;
  }
};
