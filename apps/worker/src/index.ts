// apps/worker/src/index.ts
// Запуск воркеров BullMQ: геокодирование и маршрутизация
import { Queue, Worker, type Job } from 'bullmq';
import {
  QueueJobName,
  QueueName,
  type DeadLetterJobData,
  type GeocodingJobData,
  type GeocodingJobResult,
  type RouteDistanceJobData,
  type RouteDistanceJobResult,
} from 'shared';
import { workerConfig } from './config';
import { logger } from './logger';
import { geocodeAddress } from './tasks/geocoding';
import { calculateRouteDistance } from './tasks/routing';

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection in worker process');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception in worker process');
  process.exit(1);
});

const baseQueueOptions = {
  connection: workerConfig.connection,
  prefix: workerConfig.prefix,
} as const;

const deadLetterQueue = new Queue<DeadLetterJobData>(QueueName.DeadLetter, {
  ...baseQueueOptions,
  defaultJobOptions: { removeOnComplete: false, removeOnFail: false },
});

const forwardToDlq = async (
  job: Job<unknown, unknown, string> | undefined,
  error: Error | null,
): Promise<void> => {
  if (!job) return;
  const payload: DeadLetterJobData = {
    queue: job.queueName as QueueName,
    jobName: job.name as QueueJobName,
    payload: job.data,
    failedReason: error ? error.message : 'unknown',
    attemptsMade: job.attemptsMade ?? 0,
    failedAt: Date.now(),
  };

  await deadLetterQueue.add(QueueJobName.DeadLetter, payload, {
    removeOnComplete: false,
    removeOnFail: false,
  });
};

const geocodingWorker = new Worker<GeocodingJobData, GeocodingJobResult>(
  QueueName.LogisticsGeocoding,
  // Processor: pass the whole Job to geocodeAddress for maximum flexibility
  async (job: Job<GeocodingJobData, GeocodingJobResult>) => {
    // geocodeAddress expects Job or address; we pass job so it can read taskId, address etc.
    return geocodeAddress(job);
  },
  {
    ...baseQueueOptions,
    concurrency: workerConfig.concurrency,
  },
);

const routingWorker = new Worker<RouteDistanceJobData, RouteDistanceJobResult>(
  QueueName.LogisticsRouting,
  async (job: Job<RouteDistanceJobData, RouteDistanceJobResult>) => {
    // Preserve optional traceparent propagation from job.data
    const traceparent =
      typeof job.data === 'object' && job.data !== null && 'traceparent' in job.data
        ? (job.data as { traceparent?: unknown }).traceparent
        : undefined;

    // Build routing config including traceparent if provided
    const routingConfigWithTrace = {
      ...workerConfig.routing,
      ...(typeof traceparent === 'string' ? { traceparent } : {}),
    } as typeof workerConfig.routing & { traceparent?: string };

    return calculateRouteDistance(job.data.start, job.data.finish, routingConfigWithTrace);
  },
  {
    ...baseQueueOptions,
    concurrency: workerConfig.concurrency,
  },
);

const handleFailure = (
  workerName: string,
  job: Job<unknown, unknown, string> | undefined,
  error: Error,
): void => {
  logger.error(
    { jobId: job?.id, queue: job?.queueName, error },
    `${workerName} failed`,
  );
  void forwardToDlq(job, error).catch((dlqError) => {
    logger.error({ dlqError }, 'Failed to forward job to DLQ');
  });
};

geocodingWorker.on('failed', (job, error) =>
  handleFailure('Geocoder', job, error as Error),
);
routingWorker.on('failed', (job, error) =>
  handleFailure('Router', job, error as Error),
);

const shutdown = async (): Promise<void> => {
  logger.info('Shutting down BullMQ workers...');
  await Promise.all([
    geocodingWorker.close(),
    routingWorker.close(),
    deadLetterQueue.close(),
  ]);
  logger.info('Workers stopped');
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});

logger.info(
  {
    prefix: workerConfig.prefix,
    attempts: workerConfig.attempts,
    backoffMs: workerConfig.backoffMs,
    concurrency: workerConfig.concurrency,
  },
  'BullMQ workers started',
);
