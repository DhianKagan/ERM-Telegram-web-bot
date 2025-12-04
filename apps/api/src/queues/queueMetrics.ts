// Назначение: сбор метрик длины очередей BullMQ
// Основные модули: prom-client, BullMQ
import { Gauge } from 'prom-client';
import { QueueName } from 'shared';
import { register } from '../metrics';
import { queueConfig } from '../config/queue';
import { getQueueBundle } from './taskQueue';

const queueJobsGauge = new Gauge({
  name: 'bullmq_jobs_total',
  help: 'Количество задач в очередях BullMQ по состояниям',
  labelNames: ['queue', 'state'],
  registers: [register],
});

const monitoredQueues: QueueName[] = [
  QueueName.LogisticsGeocoding,
  QueueName.LogisticsRouting,
  QueueName.DeadLetter,
];

const collectQueueCounts = async (queueName: QueueName): Promise<void> => {
  const bundle = getQueueBundle(queueName);
  if (!bundle) {
    return;
  }

  const counts = await bundle.queue.getJobCounts(
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
  queueJobsGauge.set({ queue: queueName, state: 'active' }, counts.active ?? 0);
  queueJobsGauge.set(
    { queue: queueName, state: 'delayed' },
    counts.delayed ?? 0,
  );
  queueJobsGauge.set({ queue: queueName, state: 'failed' }, counts.failed ?? 0);
  queueJobsGauge.set(
    { queue: queueName, state: 'completed' },
    counts.completed ?? 0,
  );
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
