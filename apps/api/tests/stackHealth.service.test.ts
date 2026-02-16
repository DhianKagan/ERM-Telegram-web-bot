process.env.NODE_ENV = 'test';

import StackHealthService, {
  type StackCheckResult,
} from '../src/system/stackHealth.service';

describe('StackHealthService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('run возвращает проверки s3/storage/redis/mongo без proxy', async () => {
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

    const report = await service.run({});

    expect(report.ok).toBe(true);
    expect(report.results.map((item) => item.name)).toEqual([
      's3',
      'storage',
      'redis',
      'mongo',
    ]);
    expect(report.results.every((item) => item.name !== 'proxy')).toBe(true);
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

    const report = await service.run({});

    expect(report.ok).toBe(false);
  });
});
