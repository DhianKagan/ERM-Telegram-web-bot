process.env.NODE_ENV = 'test';

import fs from 'node:fs/promises';
import StackHealthService, {
  type StackCheckResult,
} from '../src/system/stackHealth.service';
import * as s3Health from '../src/services/s3Health';
import * as taskQueue from '../src/queues/taskQueue';
import { QueueName } from 'shared';
import { register } from '../src/metrics';
import { queueConfig } from '../src/config/queue';

describe('StackHealthService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('run возвращает проверки s3/storage/redis/mongo/bullmq без proxy', async () => {
    const service = new StackHealthService();

    jest.spyOn(service, 'checkS3').mockResolvedValue({
      name: 's3',
      status: 'ok',
      durationMs: 11,
    } satisfies StackCheckResult);

    jest.spyOn(service, 'checkStorage').mockResolvedValue({
      name: 'storage',
      status: 'ok',
      durationMs: 7,
    } satisfies StackCheckResult);

    jest.spyOn(service, 'checkRedis').mockResolvedValue({
      name: 'redis',
      status: 'warn',
      durationMs: 20,
      message: 'Redis не настроен',
    } satisfies StackCheckResult);

    jest.spyOn(service, 'checkMongo').mockResolvedValue({
      name: 'mongo',
      status: 'ok',
      durationMs: 9,
    } satisfies StackCheckResult);

    jest.spyOn(service, 'checkBullmq').mockResolvedValue({
      name: 'bullmq',
      status: 'ok',
      durationMs: 6,
    } satisfies StackCheckResult);

    const report = await service.run({});

    expect(report.ok).toBe(true);
    expect(report.results.map((item) => item.name)).toEqual([
      's3',
      'storage',
      'redis',
      'mongo',
      'bullmq',
    ]);
    expect(report.results.every((item) => item.name !== 'proxy')).toBe(true);

    const aggregateMetric = register.getSingleMetric('stack_health_status');
    expect(aggregateMetric).toBeDefined();
    const snapshot = await aggregateMetric?.get();
    const metricValue = snapshot?.values?.[0]?.value;
    expect(metricValue).toBe(1);
  });

  test('run выставляет ok=false если есть error', async () => {
    const service = new StackHealthService();

    jest.spyOn(service, 'checkS3').mockResolvedValue({
      name: 's3',
      status: 'error',
      durationMs: 3,
      message: 'S3 timeout',
    } satisfies StackCheckResult);
    jest.spyOn(service, 'checkStorage').mockResolvedValue({
      name: 'storage',
      status: 'ok',
      durationMs: 2,
    } satisfies StackCheckResult);
    jest.spyOn(service, 'checkRedis').mockResolvedValue({
      name: 'redis',
      status: 'ok',
      durationMs: 2,
    } satisfies StackCheckResult);
    jest.spyOn(service, 'checkMongo').mockResolvedValue({
      name: 'mongo',
      status: 'ok',
      durationMs: 2,
    } satisfies StackCheckResult);
    jest.spyOn(service, 'checkBullmq').mockResolvedValue({
      name: 'bullmq',
      status: 'ok',
      durationMs: 2,
    } satisfies StackCheckResult);

    const report = await service.run({});

    expect(report.ok).toBe(false);
  });

  test('checkStorage возвращает error если STORAGE_DIR отсутствует и не создаёт его', async () => {
    const service = new StackHealthService();

    const statSpy = jest
      .spyOn(fs, 'stat')
      .mockRejectedValue(new Error('ENOENT: no such file or directory'));
    const accessSpy = jest.spyOn(fs, 'access');
    const writeSpy = jest.spyOn(fs, 'writeFile');
    const mkdirSpy = jest.spyOn(fs, 'mkdir');

    const result = await service.checkStorage();

    expect(result.name).toBe('storage');
    expect(result.status).toBe('error');
    expect(result.message).toContain('ENOENT');
    expect(statSpy).toHaveBeenCalledTimes(1);
    expect(accessSpy).not.toHaveBeenCalled();
    expect(writeSpy).not.toHaveBeenCalled();
    expect(mkdirSpy).not.toHaveBeenCalled();
  });

  test('checkS3 нормализует durationMs, если healthcheck вернул latencyMs=0', async () => {
    const service = new StackHealthService();
    jest.spyOn(s3Health, 'runS3Healthcheck').mockResolvedValue({
      status: 'degraded',
      checkedAt: new Date().toISOString(),
      latencyMs: 0,
      metadata: {
        configured: false,
        missing: ['S3_ENDPOINT'],
        invalid: [],
      },
      error: {
        kind: 'config',
        message: 'S3 конфиг не задан',
      },
    });

    const result = await service.checkS3();

    expect(result.status).toBe('warn');
    expect(result.durationMs).toBeGreaterThanOrEqual(1);
    expect(result.meta?.hint).toContain('S3_REGION');
    expect(result.meta?.hint).toContain('S3_FORCE_PATH_STYLE');
  });

  test('checkBullmq возвращает warn с подсказкой для failed/dlq waiting задач', async () => {
    const service = new StackHealthService();
    const previousEnabled = queueConfig.enabled;
    const previousConnection = queueConfig.connection;
    queueConfig.enabled = true;
    queueConfig.connection = {
      host: '127.0.0.1',
      port: 6379,
    };
    const getJobCounts = jest
      .fn()
      .mockResolvedValueOnce({
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 2,
        completed: 10,
      })
      .mockResolvedValueOnce({
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        completed: 10,
      })
      .mockResolvedValueOnce({
        waiting: 6,
        active: 0,
        delayed: 0,
        failed: 0,
        completed: 0,
      });

    jest.spyOn(taskQueue, 'getQueueBundle').mockImplementation(() => {
      return {
        queue: {
          getJobCounts,
        },
      } as unknown as ReturnType<typeof taskQueue.getQueueBundle>;
    });

    const result = await service.checkBullmq({
      queueNames: [
        QueueName.LogisticsGeocoding,
        QueueName.LogisticsRouting,
        QueueName.DeadLetter,
      ],
    });

    queueConfig.enabled = previousEnabled;
    queueConfig.connection = previousConnection;

    expect(result.status).toBe('warn');
    expect(result.message).toContain('logistics-geocoding:failed=2');
    expect(result.message).toContain('logistics-dead-letter:waiting=6');
    expect(result.meta?.hint).toContain('/api/v1/system/queues/recover');
  });

  test('checkBullmq возвращает warn, если очередь отключена конфигом', async () => {
    const service = new StackHealthService();
    const previousEnabled = queueConfig.enabled;
    const previousConnection = queueConfig.connection;

    queueConfig.enabled = false;
    queueConfig.connection = null;

    const result = await service.checkBullmq({
      queueNames: [QueueName.LogisticsGeocoding],
    });

    queueConfig.enabled = previousEnabled;
    queueConfig.connection = previousConnection;

    expect(result.status).toBe('warn');
    expect(result.message).toContain('BullMQ отключен или не настроен');
    expect(result.meta?.hint).toContain('QUEUE_REDIS_URL');
  });

  test('checkBullmq возвращает warn, если часть очередей недоступна', async () => {
    const service = new StackHealthService();
    const previousEnabled = queueConfig.enabled;
    const previousConnection = queueConfig.connection;
    queueConfig.enabled = true;
    queueConfig.connection = {
      host: '127.0.0.1',
      port: 6379,
    };
    const getQueueBundleSpy = jest
      .spyOn(taskQueue, 'getQueueBundle')
      .mockImplementation((queueName: QueueName) => {
        if (queueName === QueueName.LogisticsRouting) {
          return null;
        }

        return {
          queue: {
            getJobCounts: jest.fn().mockResolvedValue({
              waiting: 0,
              active: 0,
              delayed: 0,
              failed: 0,
              completed: 1,
            }),
          },
        } as unknown as ReturnType<typeof taskQueue.getQueueBundle>;
      });

    const result = await service.checkBullmq({
      queueNames: [QueueName.LogisticsGeocoding, QueueName.LogisticsRouting],
    });

    queueConfig.enabled = previousEnabled;
    queueConfig.connection = previousConnection;
    getQueueBundleSpy.mockRestore();

    expect(result.status).toBe('warn');
    expect(result.message).toContain('logistics-routing:unavailable');
  });
});
