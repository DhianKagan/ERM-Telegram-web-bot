// Назначение: сбор метрик длины очередей BullMQ
// Основные модули: prom-client, BullMQ
import { Queue } from 'bullmq';
import { Gauge } from 'prom-client';
import { QueueName } from 'shared';
import { register } from '../metrics';
import { queueConfig } from '../config/queue';

const queueJobsGauge = new Gauge({
  name: 'bullmq_jobs_total',
  help: 'Количество задач в очередях BullMQ по состояниям',
  labelNames: ['queue', 'state'],
  registers: [register],
});

const queueOldestWaitGauge = new Gauge({
  name: 'bullmq_queue_oldest_wait_seconds',
  help: 'Возраст самой старой задачи в состоянии waiting',
  labelNames: ['queue'],
  registers: [register],
});

const monitoredQueues: QueueName[] = [
  QueueName.LogisticsGeocoding,
  QueueName.LogisticsRouting,
  QueueName.DeadLetter,
];

const metricsQueues = new Map<QueueName, Queue>();

const getMetricsQueue = (queueName: QueueName): Queue | null => {
  if (!queueConfig.enabled || !queueConfig.connection) {
    return null;
  }

  const existing = metricsQueues.get(queueName);
  if (existing) {
    return existing;
  }

  const queue = new Queue(queueName, {
    connection: queueConfig.connection,
    prefix: queueConfig.prefix,
  });

  metricsQueues.set(queueName, queue);
  return queue;
};

const closeMetricsQueue = async (queueName: QueueName): Promise<void> => {
  const queue = metricsQueues.get(queueName);
  if (!queue) {
    return;
  }

  metricsQueues.delete(queueName);
  await queue.close().catch(() => undefined);
};

const collectQueueCounts = async (queueName: QueueName): Promise<void> => {
  const queue = getMetricsQueue(queueName);
  if (!queue) {
    return;
  }

  try {
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'failed',
      'completed',
    );

    queueJobsGauge.set(
      { queue: queueName, state: 'waiting' },
      counts.waiting ?? 0,
    );
    queueJobsGauge.set(
      { queue: queueName, state: 'active' },
      counts.active ?? 0,
    );
    queueJobsGauge.set(
      { queue: queueName, state: 'delayed' },
      counts.delayed ?? 0,
    );
    queueJobsGauge.set(
      { queue: queueName, state: 'failed' },
      counts.failed ?? 0,
    );
    queueJobsGauge.set(
      { queue: queueName, state: 'completed' },
      counts.completed ?? 0,
    );

    if ((counts.waiting ?? 0) === 0) {
      queueOldestWaitGauge.set({ queue: queueName }, 0);
      return;
    }

    const oldestWaiting = await queue.getJobs(['waiting'], 0, 0, true);
    const oldest = oldestWaiting[0];
    if (!oldest || !oldest.timestamp) {
      queueOldestWaitGauge.set({ queue: queueName }, 0);
      return;
    }

    const ageSeconds = Math.max(0, (Date.now() - oldest.timestamp) / 1000);
    queueOldestWaitGauge.set({ queue: queueName }, ageSeconds);
  } catch (error) {
    await closeMetricsQueue(queueName);
    throw error;
  }
};

let poller: NodeJS.Timeout | null = null;

export const startQueueMetricsPoller = (): void => {
  if (!queueConfig.enabled || !queueConfig.connection) {
    return;
  }
  if (poller) {
    return;
  }

  const collect = async (): Promise<void> => {
    for (const queueName of monitoredQueues) {
      try {
        await collectQueueCounts(queueName);
      } catch (error) {
        console.error('Не удалось обновить метрики очереди', queueName, error);
      }
    }
  };

  void collect();

  poller = setInterval(() => {
    void collect();
  }, queueConfig.metricsIntervalMs);

  poller.unref?.();
};

export const stopQueueMetricsPoller = (): void => {
  if (poller) {
    clearInterval(poller);
    poller = null;
  }

  const pendingClosers = Array.from(metricsQueues.keys()).map((queueName) =>
    closeMetricsQueue(queueName),
  );
  void Promise.all(pendingClosers);
};
