// Назначение: запуск воркеров BullMQ для геокодирования и маршрутизации
// Основные модули: BullMQ, config, tasks
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
  logger.error({ reason }, 'Необработанное отклонённое обещание в воркере');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Необработанное исключение в воркере');
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
  if (!job) {
    return;
  }
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
  async (job) => geocodeAddress(job.data.address, workerConfig.geocoder),
  {
    ...baseQueueOptions,
    concurrency: workerConfig.concurrency,
  },
);

const routingWorker = new Worker<RouteDistanceJobData, RouteDistanceJobResult>(
  QueueName.LogisticsRouting,
  async (job) =>
    calculateRouteDistance(
      job.data.start,
      job.data.finish,
      workerConfig.routing,
    ),
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
    `${workerName} завершился с ошибкой`,
  );
  void forwardToDlq(job, error).catch((dlqError) => {
    logger.error({ dlqError }, 'Не удалось поместить задачу в DLQ');
  });
};

geocodingWorker.on('failed', (job, error) =>
  handleFailure('Геокодер', job, error),
);
routingWorker.on('failed', (job, error) =>
  handleFailure('Маршрутизатор', job, error),
);

const shutdown = async (): Promise<void> => {
  logger.info('Останавливаем воркеры BullMQ...');
  await Promise.all([
    geocodingWorker.close(),
    routingWorker.close(),
    deadLetterQueue.close(),
  ]);
  logger.info('Воркеры BullMQ остановлены корректно');
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
  'Воркеры BullMQ запущены',
);
