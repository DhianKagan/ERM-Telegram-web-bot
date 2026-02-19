process.env.NODE_ENV = 'test';

import { readS3Config } from '../src/config/s3';
import { classifyS3Error, runS3Healthcheck } from '../src/services/s3Health';

describe('s3 config', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  test('возвращает missing/invalid при неполной конфигурации', () => {
    delete process.env.S3_ENDPOINT;
    process.env.S3_REGION = 'eu-central-1';
    process.env.S3_BUCKET = 'bucket';
    process.env.S3_ACCESS_KEY_ID = 'key';
    process.env.S3_SECRET_ACCESS_KEY = 'secret';
    process.env.S3_FORCE_PATH_STYLE = 'abc';
    process.env.S3_USE_SSL = 'true';

    const result = readS3Config();

    expect(result.ok).toBe(false);
    expect(result.missing).toContain('S3_ENDPOINT');
    expect(result.invalid).toContain('S3_FORCE_PATH_STYLE');
  });

  test('S3_USE_SSL опционален и берётся из схемы endpoint', () => {
    process.env.S3_ENDPOINT = 'http://localhost:9000';
    process.env.S3_REGION = 'eu-central-1';
    process.env.S3_BUCKET = 'bucket';
    process.env.S3_ACCESS_KEY_ID = 'key';
    process.env.S3_SECRET_ACCESS_KEY = 'secret';
    process.env.S3_FORCE_PATH_STYLE = 'true';
    delete process.env.S3_USE_SSL;

    const result = readS3Config();

    expect(result.ok).toBe(true);
    expect(result.config?.useSsl).toBe(false);
    expect(result.invalid).toEqual([]);
  });
});

describe('s3 health', () => {
  const validConfig = {
    ok: true as const,
    missing: [],
    invalid: [],
    config: {
      endpoint: 'http://localhost:9000',
      region: 'eu-central-1',
      bucket: 'bucket',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      forcePathStyle: true,
      useSsl: false,
    },
  };

  test('fallback в degraded при ошибке сети', async () => {
    const client = {
      send: jest.fn().mockRejectedValue({
        name: 'TimeoutError',
        message: 'socket timeout',
      }),
    };

    const report = await runS3Healthcheck({
      configValidation: validConfig,
      client,
    });

    expect(report.status).toBe('degraded');
    expect(report.error?.kind).toBe('network');
    expect(client.send).toHaveBeenCalledTimes(1);
  });

  test('успешный healthcheck выполняет HeadBucket и ListObjectsV2', async () => {
    const client = {
      send: jest.fn().mockResolvedValue({}),
    };

    const report = await runS3Healthcheck({
      configValidation: validConfig,
      client,
    });

    expect(report.status).toBe('ok');
    expect(client.send).toHaveBeenCalledTimes(2);
  });

  test('классифицирует signature/auth/bucket-not-found', () => {
    expect(
      classifyS3Error({ name: 'SignatureDoesNotMatch', message: 'bad sign' }),
    ).toBe('signature');
    expect(
      classifyS3Error({
        name: 'AccessDenied',
        $metadata: { httpStatusCode: 403 },
      }),
    ).toBe('auth');
    expect(classifyS3Error({ Code: 'NoSuchBucket' })).toBe('bucket-not-found');
  });

  test('для bucket-not-found с Unknown добавляет понятную подсказку', async () => {
    const client = {
      send: jest.fn().mockRejectedValue({
        Code: 'NoSuchBucket',
        message: 'Unknown',
      }),
    };

    const report = await runS3Healthcheck({
      configValidation: validConfig,
      client,
    });

    expect(report.status).toBe('degraded');
    expect(report.error?.kind).toBe('bucket-not-found');
    expect(report.error?.message).toContain('Bucket не найден');
  });
});
