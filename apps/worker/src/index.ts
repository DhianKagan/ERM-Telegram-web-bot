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

const geocodingQueue = new Queue<GeocodingJobData>(
  QueueName.LogisticsGeocoding,
  baseQueueOptions,
);
const routingQueue = new Queue<RouteDistanceJobData>(
  QueueName.LogisticsRouting,
  baseQueueOptions,
);
const deadLetterQueue = new Queue<DeadLetterJobData>(QueueName.DeadLetter, {
  ...baseQueueOptions,
  defaultJobOptions: { removeOnComplete: false, removeOnFail: false },
});

void deadLetterQueue
  .waitUntilReady()
  .then(() => {
    logger.info({ queue: QueueName.DeadLetter }, 'BullMQ DLQ connection ready');
  })
  .catch((error) => {
    logger.error(
      { alert: true, queue: QueueName.DeadLetter, error },
      'BullMQ DLQ connection error',
    );
  });
deadLetterQueue.on('error', (error) => {
  logger.error(
    { alert: true, queue: QueueName.DeadLetter, error },
    'BullMQ DLQ connection error',
  );
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
      typeof job.data === 'object' &&
      job.data !== null &&
      'traceparent' in job.data
        ? (job.data as { traceparent?: unknown }).traceparent
        : undefined;

    // Build routing config including traceparent if provided
    const routingConfigWithTrace = {
      ...workerConfig.routing,
      ...(typeof traceparent === 'string' ? { traceparent } : {}),
    } as typeof workerConfig.routing & { traceparent?: string };

    return calculateRouteDistance(
      job.data.start,
      job.data.finish,
      routingConfigWithTrace,
    );
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
geocodingWorker.on('ready', () => {
  logger.info({ queue: QueueName.LogisticsGeocoding }, 'Geocoder worker ready');
});
geocodingWorker.on('error', (error) => {
  logger.error(
    { alert: true, queue: QueueName.LogisticsGeocoding, error },
    'Geocoder worker connection error',
  );
});
routingWorker.on('ready', () => {
  logger.info({ queue: QueueName.LogisticsRouting }, 'Router worker ready');
});
routingWorker.on('error', (error) => {
  logger.error(
    { alert: true, queue: QueueName.LogisticsRouting, error },
    'Router worker connection error',
  );
});

const shutdownTimeoutMs = Number.parseInt(
  process.env.WORKER_SHUTDOWN_TIMEOUT_MS || '30000',
  10,
);
let isShuttingDown = false;

const pauseQueues = async (): Promise<void> => {
  try {
    await Promise.all([geocodingQueue.pause(), routingQueue.pause()]);
    logger.info('Queues paused, stopping workers...');
  } catch (error) {
    logger.warn({ error }, 'Failed to pause queues before shutdown');
  }
};

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (isShuttingDown) {
    logger.warn({ signal }, 'Shutdown already in progress');
    return;
  }
  isShuttingDown = true;
  logger.info(
    { signal, timeoutMs: shutdownTimeoutMs },
    'Shutting down BullMQ workers...',
  );

  const shutdownTimer = setTimeout(() => {
    logger.error(
      { timeoutMs: shutdownTimeoutMs },
      'Graceful shutdown timed out, forcing exit',
    );
    process.exit(1);
  }, shutdownTimeoutMs);

  try {
    await pauseQueues();
    await Promise.all([geocodingWorker.close(), routingWorker.close()]);
    await Promise.all([
      geocodingQueue.close(),
      routingQueue.close(),
      deadLetterQueue.close(),
    ]);
    clearTimeout(shutdownTimer);
    logger.info('Workers stopped');
    process.exit(0);
  } catch (error) {
    clearTimeout(shutdownTimer);
    logger.error({ error }, 'Graceful shutdown failed');
    process.exit(1);
  }
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
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
