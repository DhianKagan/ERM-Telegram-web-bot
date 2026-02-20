// apps/api/src/queues/taskQueue.ts
// Назначение: постановка задач в очереди BullMQ и ожидание результатов
import { Queue, QueueEvents, type JobsOptions, type Job } from 'bullmq';
import { createHash } from 'node:crypto';
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
import {
  bullmqJobProcessingDurationSeconds,
  bullmqJobsProcessedTotal,
  bullmqJobWaitDurationSeconds,
  normalizeBullMqErrorClass,
  type BullMqJobStatus,
} from '../metrics';

type QueueBundle = {
  queue: Queue;
  events: QueueEvents;
};

const bundles = new Map<QueueName, QueueBundle>();

const buildJobOptions = (): JobsOptions => ({
  attempts: queueConfig.attempts,
  backoff: { type: 'exponential', delay: queueConfig.backoffMs },
  removeOnComplete: { count: 1000 },
  removeOnFail: { age: 86400 },
});

const buildJobId = (prefix: string, payload: unknown): string => {
  const hash = createHash('sha1').update(JSON.stringify(payload)).digest('hex');
  return `${prefix}-${hash}`;
};

const disableQueues = (reason: string, error?: unknown): void => {
  if (!queueConfig.enabled) {
    return;
  }
  queueConfig.enabled = false;
  console.error(`Очереди BullMQ отключены: ${reason}`, error);
  for (const bundle of bundles.values()) {
    void bundle.queue.close().catch(() => undefined);
    void bundle.events.close().catch(() => undefined);
  }
  bundles.clear();
};

const enableQueues = (): void => {
  if (queueConfig.enabled || !queueConfig.connection) {
    return;
  }
  queueConfig.enabled = true;
  console.info('Очереди BullMQ снова доступны');
};

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

  void queue
    .waitUntilReady()
    .then(() => {
      enableQueues();
      console.info(`Очередь BullMQ готова к работе: ${queueName}`);
    })
    .catch((error) => {
      disableQueues(`ошибка готовности очереди ${queueName}`, error);
    });
  queue.on('error', (error) => {
    disableQueues(`ошибка соединения в очереди ${queueName}`, error);
  });

  const events = new QueueEvents(queueName, options);
  void events
    .waitUntilReady()
    .then(() => {
      enableQueues();
      console.info(`События BullMQ готовы: ${queueName}`);
    })
    .catch((error) => {
      disableQueues(`ошибка готовности событий очереди ${queueName}`, error);
    });
  events.on('error', (error) => {
    disableQueues(`события очереди ${queueName} недоступны`, error);
  });

  return { queue, events } satisfies QueueBundle;
};

export const getQueueBundle = (queueName: QueueName): QueueBundle | null => {
  if (!queueConfig.enabled || !queueConfig.connection) {
    return null;
  }
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

export const closeQueueBundles = async (): Promise<void> => {
  const closers = Array.from(bundles.values()).map(async (bundle) => {
    await Promise.all([
      bundle.queue.close().catch(() => undefined),
      bundle.events.close().catch(() => undefined),
    ]);
  });
  bundles.clear();
  await Promise.all(closers);
};

const waitForResult = async <T>(
  queueName: QueueName,
  jobName: QueueJobName,
  queue: Queue,
  job: Job,
  events: QueueEvents,
  fallback: () => Promise<T>,
): Promise<T> => {
  const waitStartedAt = Date.now();

  const observeWait = (status: BullMqJobStatus): void => {
    bullmqJobWaitDurationSeconds.observe(
      { queue: queueName, job: jobName, status },
      (Date.now() - waitStartedAt) / 1000,
    );
  };

  const observeProcessing = async (status: BullMqJobStatus): Promise<void> => {
    try {
      if (!job.id) {
        return;
      }
      const freshJob = await queue.getJob(job.id);
      if (!freshJob?.processedOn || !freshJob?.finishedOn) {
        return;
      }
      const durationSeconds = Math.max(
        0,
        (freshJob.finishedOn - freshJob.processedOn) / 1000,
      );
      bullmqJobProcessingDurationSeconds.observe(
        { queue: queueName, job: jobName, status },
        durationSeconds,
      );
    } catch {
      // игнорируем ошибки получения job-метаданных
    }
  };

  try {
    const result = await job.waitUntilFinished(
      events,
      queueConfig.jobTimeoutMs,
    );
    observeWait('completed');
    bullmqJobsProcessedTotal.inc({
      queue: queueName,
      job: jobName,
      status: 'completed',
      error_class: 'unknown',
    });
    await observeProcessing('completed');
    return result as T;
  } catch (error) {
    console.error('Не удалось дождаться результата задачи BullMQ', error);
    const isTimeout =
      error instanceof Error &&
      error.message.toLowerCase().includes('timed out');
    const status: BullMqJobStatus = isTimeout ? 'timeout' : 'failed';
    observeWait(status);
    bullmqJobsProcessedTotal.inc({
      queue: queueName,
      job: jobName,
      status,
      error_class: normalizeBullMqErrorClass(error),
    });
    await observeProcessing(status);
    return fallback();
  }
};

export const requestGeocodingJob = async (
  address: string,
): Promise<GeocodingJobResult> => {
  const bundle = getQueueBundle(QueueName.LogisticsGeocoding);
  if (!bundle) {
    bullmqJobsProcessedTotal.inc({
      queue: QueueName.LogisticsGeocoding,
      job: QueueJobName.GeocodeAddress,
      status: 'failed',
      error_class: 'unknown',
    });
    return geocodeAddress(address);
  }

  try {
    const payload = { address };
    const job = await bundle.queue.add(QueueJobName.GeocodeAddress, payload, {
      ...buildJobOptions(),
      jobId: buildJobId('geocode', payload),
    });
    return waitForResult<GeocodingJobResult>(
      QueueName.LogisticsGeocoding,
      QueueJobName.GeocodeAddress,
      bundle.queue,
      job,
      bundle.events,
      () => geocodeAddress(address),
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
    bullmqJobsProcessedTotal.inc({
      queue: QueueName.LogisticsRouting,
      job: QueueJobName.RouteDistance,
      status: 'failed',
      error_class: 'unknown',
    });
    // synchronous fallback to local OSRM/ORS call
    const distanceKm = await getOsrmDistance(params);
    return { distanceKm } satisfies RouteDistanceJobResult;
  }

  try {
    // include traceparent in job data so worker can propagate it
    const jobPayload = {
      ...params,
      ...(context?.traceparent ? { traceparent: context.traceparent } : {}),
    };
    const job = await bundle.queue.add(QueueJobName.RouteDistance, jobPayload, {
      ...buildJobOptions(),
      jobId: buildJobId('route', jobPayload),
    });
    return waitForResult<RouteDistanceJobResult>(
      QueueName.LogisticsRouting,
      QueueJobName.RouteDistance,
      bundle.queue,
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
