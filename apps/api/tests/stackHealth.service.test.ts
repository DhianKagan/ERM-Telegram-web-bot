process.env.NODE_ENV = 'test';

import fs from 'node:fs/promises';
import StackHealthService, {
  type StackCheckResult,
} from '../src/system/stackHealth.service';
import { register } from '../src/metrics';

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
});
