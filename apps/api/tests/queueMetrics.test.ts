import { QueueName } from 'shared';

type MockQueue = {
  getJobCounts: jest.Mock;
  getJobs: jest.Mock;
  close: jest.Mock;
  on: jest.Mock;
};

const queueCtor = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn((...args) => queueCtor(...args)),
}));

const mockedQueueConfig = {
  enabled: true,
  connection: { host: '127.0.0.1', port: 6379 },
  prefix: 'erm',
  attempts: 3,
  backoffMs: 5000,
  jobTimeoutMs: 30000,
  metricsIntervalMs: 60_000,
  reconnectCooldownMs: 60_000,
};

jest.mock('../src/config/queue', () => ({
  queueConfig: mockedQueueConfig,
  isQueueAvailable: jest.fn(() => Boolean(mockedQueueConfig.enabled)),
  markQueueUnavailable: jest.fn(() => {
    mockedQueueConfig.enabled = false;
  }),
}));

const flushPromises = async (): Promise<void> => {
  await new Promise<void>((resolve) => setImmediate(resolve));
};

const queueMetricsModule = import('../src/queues/queueMetrics');

const createMockQueue = (overrides: Partial<MockQueue> = {}): MockQueue => ({
  getJobCounts: jest.fn().mockResolvedValue({
    waiting: 0,
    active: 0,
    delayed: 0,
    failed: 0,
    completed: 0,
  }),
  getJobs: jest.fn().mockResolvedValue([]),
  close: jest.fn().mockResolvedValue(undefined),
  on: jest.fn().mockReturnThis(),
  ...overrides,
});

describe('queueMetrics poller', () => {
  beforeEach(() => {
    queueCtor.mockReset();
    mockedQueueConfig.enabled = true;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('закрывает проблемную read-only очередь и создаёт новую при повторном запуске', async () => {
    const geocodingFirst = createMockQueue({
      getJobCounts: jest.fn().mockRejectedValue(new Error('read ETIMEDOUT')),
    });
    const geocodingSecond = createMockQueue({
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        completed: 1,
      }),
    });

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
      return createMockQueue();
    });

    const { startQueueMetricsPoller, stopQueueMetricsPoller } =
      await queueMetricsModule;

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

    mockedQueueConfig.enabled = true;
    startQueueMetricsPoller();
    await flushPromises();

    expect(createdByQueue[QueueName.LogisticsGeocoding]).toBe(2);
    expect(geocodingSecond.getJobCounts).toHaveBeenCalledTimes(1);

    stopQueueMetricsPoller();
    await flushPromises();

    expect(geocodingSecond.close).toHaveBeenCalledTimes(1);
  });

  test('регистрирует обработчик ошибки очереди метрик и закрывает очередь при событии error', async () => {
    const geocodingQueue = createMockQueue();
    const otherQueues = [createMockQueue(), createMockQueue()];

    queueCtor
      .mockImplementationOnce(() => geocodingQueue)
      .mockImplementationOnce(() => otherQueues[0])
      .mockImplementationOnce(() => otherQueues[1]);

    const { startQueueMetricsPoller, stopQueueMetricsPoller } =
      await queueMetricsModule;

    startQueueMetricsPoller();
    await flushPromises();

    expect(geocodingQueue.on).toHaveBeenCalledWith(
      'error',
      expect.any(Function),
    );

    const [, errorHandler] = geocodingQueue.on.mock.calls.find(
      ([eventName]) => eventName === 'error',
    ) ?? [undefined, undefined];

    expect(errorHandler).toEqual(expect.any(Function));

    const disconnectError = new Error('redis connection lost');
    errorHandler(disconnectError);
    await flushPromises();

    expect(console.error).toHaveBeenCalledWith(
      'Очередь метрик BullMQ недоступна',
      QueueName.LogisticsGeocoding,
      disconnectError,
    );
    expect(geocodingQueue.close).toHaveBeenCalledTimes(1);

    stopQueueMetricsPoller();
    await flushPromises();
  });
});
