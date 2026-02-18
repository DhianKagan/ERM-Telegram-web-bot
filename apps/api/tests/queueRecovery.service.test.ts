process.env.NODE_ENV = 'test';

import { QueueJobName, QueueName } from 'shared';

type QueueMock = {
  getJobs: jest.Mock<Promise<unknown[]>, [unknown, number, number, boolean]>;
  add?: jest.Mock<Promise<void>, [unknown, unknown, unknown]>;
  close: jest.Mock<Promise<void>, []>;
};

const queueMocks = new Map<string, QueueMock>();

jest.mock('../src/config/queue', () => ({
  queueConfig: {
    enabled: true,
    connection: { url: 'redis://localhost:6379' },
    prefix: 'erm',
    attempts: 3,
    backoffMs: 1000,
  },
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation((name: string) => {
    const mock = queueMocks.get(name) ?? {
      getJobs: jest.fn(async () => []),
      add: jest.fn(async () => undefined),
      close: jest.fn(async () => undefined),
    };
    return mock;
  }),
}));

import QueueRecoveryService from '../src/system/queueRecovery.service';

describe('QueueRecoveryService', () => {
  beforeEach(() => {
    queueMocks.clear();
    jest.clearAllMocks();
  });

  test('удаляет некорректные DLQ задачи при removeSkippedDeadLetter=true', async () => {
    const invalidDlqJob = {
      id: 'dlq-invalid-1',
      data: { queue: QueueName.DeadLetter, jobName: QueueJobName.DeadLetter },
      remove: jest.fn(async () => undefined),
    };

    queueMocks.set(QueueName.LogisticsGeocoding, {
      getJobs: jest.fn(async () => []),
      close: jest.fn(async () => undefined),
    });
    queueMocks.set(QueueName.LogisticsRouting, {
      getJobs: jest.fn(async () => []),
      close: jest.fn(async () => undefined),
    });
    queueMocks.set(QueueName.DeadLetter, {
      getJobs: jest
        .fn()
        .mockResolvedValueOnce([invalidDlqJob])
        .mockResolvedValue([]),
      close: jest.fn(async () => undefined),
    });

    const service = new QueueRecoveryService();

    const result = await service.recover({
      dryRun: false,
      deadLetterLimit: 20,
      geocodingFailedLimit: 20,
      routingFailedLimit: 20,
      removeReplayedDeadLetter: false,
      removeSkippedDeadLetter: true,
    });

    expect(result.enabled).toBe(true);
    expect(result.deadLetterScanned).toBe(1);
    expect(result.deadLetterSkipped).toBe(1);
    expect(result.deadLetterSkippedRemoved).toBe(1);
    expect(invalidDlqJob.remove).toHaveBeenCalledTimes(1);
  });
});
