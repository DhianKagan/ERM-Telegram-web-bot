// Назначение: диагностика и восстановление задач BullMQ (failed + dead-letter)
// Основные модули: bullmq, shared queue types, queue config
import {
  Queue,
  type ConnectionOptions,
  type JobsOptions,
  type Job,
} from 'bullmq';
import { QueueJobName, QueueName, type DeadLetterJobData } from 'shared';
import { queueConfig } from '../config/queue';

type QueueJobSnapshot = {
  id: string;
  name: string;
  queue: string;
  attemptsMade: number;
  failedReason?: string;
  timestamp: number;
  data: unknown;
};

export type QueueRecoveryDiagnostics = {
  enabled: boolean;
  generatedAt: string;
  geocodingFailed: QueueJobSnapshot[];
  deadLetterWaiting: QueueJobSnapshot[];
  deadLetterFailed: QueueJobSnapshot[];
};

export type QueueRecoveryOptions = {
  geocodingFailedLimit: number;
  deadLetterLimit: number;
  dryRun: boolean;
  removeReplayedDeadLetter: boolean;
};

export type QueueRecoveryResult = {
  enabled: boolean;
  dryRun: boolean;
  geocodingFailedScanned: number;
  geocodingRetried: number;
  deadLetterScanned: number;
  deadLetterReplayed: number;
  deadLetterRemoved: number;
  deadLetterSkipped: number;
  errors: string[];
};

const BASE_JOB_OPTIONS: JobsOptions = {
  attempts: queueConfig.attempts,
  backoff: { type: 'exponential', delay: queueConfig.backoffMs },
  removeOnComplete: { count: 1000 },
  removeOnFail: { age: 86400 },
};

const toSnapshot = (job: Job): QueueJobSnapshot => ({
  id: String(job.id ?? ''),
  name: job.name,
  queue: job.queueName,
  attemptsMade: job.attemptsMade,
  failedReason: job.failedReason,
  timestamp: job.timestamp ?? Date.now(),
  data: job.data,
});

const clampLimit = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.min(Math.trunc(value), 200));
};

const parseDeadLetterData = (value: unknown): DeadLetterJobData | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<DeadLetterJobData>;
  if (
    !candidate.queue ||
    !Object.values(QueueName).includes(candidate.queue) ||
    !candidate.jobName ||
    !Object.values(QueueJobName).includes(candidate.jobName)
  ) {
    return null;
  }

  return {
    queue: candidate.queue,
    jobName: candidate.jobName,
    payload: candidate.payload,
    failedReason:
      typeof candidate.failedReason === 'string'
        ? candidate.failedReason
        : 'unknown',
    attemptsMade:
      typeof candidate.attemptsMade === 'number' &&
      Number.isFinite(candidate.attemptsMade)
        ? candidate.attemptsMade
        : 0,
    failedAt:
      typeof candidate.failedAt === 'number' &&
      Number.isFinite(candidate.failedAt)
        ? candidate.failedAt
        : Date.now(),
  } satisfies DeadLetterJobData;
};

const getQueueConnection = (): ConnectionOptions => {
  if (!queueConfig.connection) {
    throw new Error('BullMQ connection is not configured');
  }
  return queueConfig.connection;
};

const createQueue = (queueName: QueueName): Queue =>
  new Queue(queueName, {
    connection: getQueueConnection(),
    prefix: queueConfig.prefix,
    defaultJobOptions: BASE_JOB_OPTIONS,
  });

const closeQueue = async (queue: Queue): Promise<void> => {
  await queue.close().catch(() => undefined);
};

export default class QueueRecoveryService {
  isEnabled(): boolean {
    return Boolean(queueConfig.enabled && queueConfig.connection);
  }

  async collectDiagnostics(limit = 20): Promise<QueueRecoveryDiagnostics> {
    const safeLimit = clampLimit(limit, 20);
    if (!this.isEnabled()) {
      return {
        enabled: false,
        generatedAt: new Date().toISOString(),
        geocodingFailed: [],
        deadLetterWaiting: [],
        deadLetterFailed: [],
      } satisfies QueueRecoveryDiagnostics;
    }

    const geocodingQueue = createQueue(QueueName.LogisticsGeocoding);
    const deadLetterQueue = createQueue(QueueName.DeadLetter);

    try {
      const geocodingFailed = await geocodingQueue.getJobs(
        ['failed'],
        0,
        safeLimit - 1,
        true,
      );
      const deadLetterWaiting = await deadLetterQueue.getJobs(
        ['waiting'],
        0,
        safeLimit - 1,
        true,
      );
      const deadLetterFailed = await deadLetterQueue.getJobs(
        ['failed'],
        0,
        safeLimit - 1,
        true,
      );

      return {
        enabled: true,
        generatedAt: new Date().toISOString(),
        geocodingFailed: geocodingFailed.map(toSnapshot),
        deadLetterWaiting: deadLetterWaiting.map(toSnapshot),
        deadLetterFailed: deadLetterFailed.map(toSnapshot),
      } satisfies QueueRecoveryDiagnostics;
    } finally {
      await Promise.all([
        closeQueue(geocodingQueue),
        closeQueue(deadLetterQueue),
      ]);
    }
  }

  async recover(
    options: Partial<QueueRecoveryOptions>,
  ): Promise<QueueRecoveryResult> {
    if (!this.isEnabled()) {
      return {
        enabled: false,
        dryRun: true,
        geocodingFailedScanned: 0,
        geocodingRetried: 0,
        deadLetterScanned: 0,
        deadLetterReplayed: 0,
        deadLetterRemoved: 0,
        deadLetterSkipped: 0,
        errors: [
          'Очереди BullMQ отключены или отсутствует подключение к Redis.',
        ],
      } satisfies QueueRecoveryResult;
    }

    const dryRun = options.dryRun !== false;
    const geocodingLimit = clampLimit(options.geocodingFailedLimit, 20);
    const deadLetterLimit = clampLimit(options.deadLetterLimit, 20);
    const removeReplayedDeadLetter = options.removeReplayedDeadLetter === true;

    const geocodingQueue = createQueue(QueueName.LogisticsGeocoding);
    const deadLetterQueue = createQueue(QueueName.DeadLetter);
    const queueCache = new Map<QueueName, Queue>();
    const errors: string[] = [];

    const ensureQueue = (name: QueueName): Queue => {
      const existing = queueCache.get(name);
      if (existing) {
        return existing;
      }
      const created = createQueue(name);
      queueCache.set(name, created);
      return created;
    };

    let geocodingRetried = 0;
    let deadLetterReplayed = 0;
    let deadLetterRemoved = 0;
    let deadLetterSkipped = 0;

    try {
      const geocodingFailedJobs = await geocodingQueue.getJobs(
        ['failed'],
        0,
        geocodingLimit - 1,
        true,
      );

      for (const failedJob of geocodingFailedJobs) {
        if (dryRun) {
          geocodingRetried += 1;
          continue;
        }
        try {
          await failedJob.retry();
          geocodingRetried += 1;
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          errors.push(
            `Не удалось повторить geocoding job ${String(failedJob.id)}: ${reason}`,
          );
        }
      }

      const deadLetterJobs = await deadLetterQueue.getJobs(
        ['waiting'],
        0,
        deadLetterLimit - 1,
        true,
      );

      for (const deadLetterJob of deadLetterJobs) {
        const parsedData = parseDeadLetterData(deadLetterJob.data);
        if (!parsedData || parsedData.queue === QueueName.DeadLetter) {
          deadLetterSkipped += 1;
          errors.push(
            `Пропущена DLQ job ${String(deadLetterJob.id)}: некорректный payload или целевая очередь logistics-dead-letter.`,
          );
          continue;
        }

        if (dryRun) {
          deadLetterReplayed += 1;
          continue;
        }

        try {
          const targetQueue = ensureQueue(parsedData.queue);
          const replayJobId = `dlq-replay:${String(deadLetterJob.id)}:${Date.now()}`;
          await targetQueue.add(parsedData.jobName, parsedData.payload, {
            ...BASE_JOB_OPTIONS,
            jobId: replayJobId,
          });
          deadLetterReplayed += 1;

          if (removeReplayedDeadLetter) {
            await deadLetterJob.remove();
            deadLetterRemoved += 1;
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          errors.push(
            `Не удалось переиграть DLQ job ${String(deadLetterJob.id)}: ${reason}`,
          );
        }
      }

      return {
        enabled: true,
        dryRun,
        geocodingFailedScanned: geocodingFailedJobs.length,
        geocodingRetried,
        deadLetterScanned: deadLetterJobs.length,
        deadLetterReplayed,
        deadLetterRemoved,
        deadLetterSkipped,
        errors,
      } satisfies QueueRecoveryResult;
    } finally {
      const closers = [
        closeQueue(geocodingQueue),
        closeQueue(deadLetterQueue),
        ...Array.from(queueCache.values()).map((queue) => closeQueue(queue)),
      ];
      await Promise.all(closers);
    }
  }
}
