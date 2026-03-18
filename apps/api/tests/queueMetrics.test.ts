import { QueueName } from 'shared';

const queueCtor = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn((...args) => queueCtor(...args)),
}));

jest.mock('../src/config/queue', () => ({
  queueConfig: {
    enabled: true,
    connection: { host: '127.0.0.1', port: 6379 },
    prefix: 'erm',
    attempts: 3,
    backoffMs: 5000,
    jobTimeoutMs: 30000,
    metricsIntervalMs: 60_000,
  },
}));

const flushPromises = async (): Promise<void> => {
  await new Promise<void>((resolve) => setImmediate(resolve));
};

describe('queueMetrics poller', () => {
  beforeEach(() => {
    queueCtor.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('закрывает проблемную read-only очередь и создаёт новую при повторном запуске', async () => {
    const genericQueueFactory = () => ({
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        completed: 0,
      }),
      getJobs: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
    });

    const geocodingFirst = {
      getJobCounts: jest.fn().mockRejectedValue(new Error('read ETIMEDOUT')),
      getJobs: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const geocodingSecond = {
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        completed: 1,
      }),
      getJobs: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
    };

    const createdByQueue: Record<string, number> = {};
    queueCtor.mockImplementation((queueName: QueueName) => {
      createdByQueue[queueName] = (createdByQueue[queueName] ?? 0) + 1;
      if (
        queueName === QueueName.LogisticsGeocoding &&
        createdByQueue[queueName] === 1
      ) {
        return geocodingFirst;
      }
      if (queueName === QueueName.LogisticsGeocoding) {
        return geocodingSecond;
      }
      return genericQueueFactory();
    });

    const { startQueueMetricsPoller, stopQueueMetricsPoller } = await import(
      '../src/queues/queueMetrics'
    );

    startQueueMetricsPoller();
    await flushPromises();

    expect(geocodingFirst.close).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      'Не удалось обновить метрики очереди',
      QueueName.LogisticsGeocoding,
      expect.any(Error),
    );

    stopQueueMetricsPoller();
    await flushPromises();

    startQueueMetricsPoller();
    await flushPromises();

    expect(createdByQueue[QueueName.LogisticsGeocoding]).toBe(2);
    expect(geocodingSecond.getJobCounts).toHaveBeenCalledTimes(1);

    stopQueueMetricsPoller();
    await flushPromises();

    expect(geocodingSecond.close).toHaveBeenCalledTimes(1);
  });
});
