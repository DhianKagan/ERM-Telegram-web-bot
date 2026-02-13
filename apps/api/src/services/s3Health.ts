// Назначение: диагностика подключения API к S3-хранилищу.
// Основные модули: AWS SDK S3, config/s3
import {
  HeadBucketCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  readS3Config,
  toS3SafeMetadata,
  type S3ConfigValidation,
} from '../config/s3';

export type S3HealthErrorKind =
  | 'auth'
  | 'network'
  | 'bucket-not-found'
  | 'signature'
  | 'config'
  | 'unknown';

export type S3HealthStatus = 'ok' | 'degraded';

export type S3HealthReport = {
  status: S3HealthStatus;
  checkedAt: string;
  latencyMs: number;
  metadata: {
    configured: boolean;
    endpoint?: string;
    region?: string;
    bucket?: string;
    forcePathStyle?: boolean;
    useSsl?: boolean;
    missing?: string[];
    invalid?: string[];
  };
  error?: {
    kind: S3HealthErrorKind;
    message: string;
  };
};

type SendCapableClient = {
  send: (command: unknown) => Promise<unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export function classifyS3Error(error: unknown): S3HealthErrorKind {
  if (!isRecord(error)) {
    return 'unknown';
  }

  const name = typeof error.name === 'string' ? error.name : '';
  const code = typeof error.Code === 'string' ? error.Code : '';
  const message =
    typeof error.message === 'string' ? error.message.toLowerCase() : '';

  const metadata = isRecord(error.$metadata) ? error.$metadata : {};
  const statusCode =
    typeof metadata.httpStatusCode === 'number' ? metadata.httpStatusCode : 0;

  if (
    [
      'InvalidAccessKeyId',
      'AccessDenied',
      'Forbidden',
      'Unauthorized',
    ].includes(code) ||
    [
      'InvalidAccessKeyId',
      'AccessDenied',
      'Forbidden',
      'Unauthorized',
    ].includes(name) ||
    statusCode === 401 ||
    statusCode === 403
  ) {
    return 'auth';
  }

  if (
    ['NoSuchBucket', 'NotFound'].includes(code) ||
    ['NoSuchBucket', 'NotFound'].includes(name) ||
    statusCode === 404
  ) {
    return 'bucket-not-found';
  }

  if (
    [
      'SignatureDoesNotMatch',
      'AuthorizationHeaderMalformed',
      'RequestTimeTooSkewed',
    ].includes(code) ||
    [
      'SignatureDoesNotMatch',
      'AuthorizationHeaderMalformed',
      'RequestTimeTooSkewed',
    ].includes(name)
  ) {
    return 'signature';
  }

  if (
    ['TimeoutError', 'NetworkingError'].includes(name) ||
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('socket hang up')
  ) {
    return 'network';
  }

  return 'unknown';
}

const getMessage = (error: unknown): string => {
  if (
    isRecord(error) &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }
  return 'Неизвестная ошибка S3';
};

const createClient = (
  cfg: NonNullable<S3ConfigValidation['config']>,
): S3Client =>
  new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    forcePathStyle: cfg.forcePathStyle,
    tls: cfg.useSsl,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });

export async function runS3Healthcheck(options?: {
  configValidation?: S3ConfigValidation;
  client?: SendCapableClient;
  now?: () => number;
}): Promise<S3HealthReport> {
  const now = options?.now ?? Date.now;
  const started = now();
  const checkedAt = new Date().toISOString();
  const configValidation = options?.configValidation ?? readS3Config();

  if (!configValidation.ok || !configValidation.config) {
    return {
      status: 'degraded',
      checkedAt,
      latencyMs: Math.max(0, now() - started),
      metadata: {
        configured: false,
        missing: configValidation.missing,
        invalid: configValidation.invalid,
      },
      error: {
        kind: 'config',
        message: 'S3-конфигурация неполная или содержит некорректные флаги',
      },
    };
  }

  const cfg = configValidation.config;
  const client = options?.client ?? createClient(cfg);

  try {
    await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
    await client.send(
      new ListObjectsV2Command({ Bucket: cfg.bucket, MaxKeys: 1 }),
    );

    return {
      status: 'ok',
      checkedAt,
      latencyMs: Math.max(0, now() - started),
      metadata: {
        configured: true,
        ...toS3SafeMetadata(cfg),
      },
    };
  } catch (error: unknown) {
    return {
      status: 'degraded',
      checkedAt,
      latencyMs: Math.max(0, now() - started),
      metadata: {
        configured: true,
        ...toS3SafeMetadata(cfg),
      },
      error: {
        kind: classifyS3Error(error),
        message: getMessage(error),
      },
    };
  }
}

export async function logS3Preflight(): Promise<void> {
  const report = await runS3Healthcheck();
  const message = {
    status: report.status,
    checkedAt: report.checkedAt,
    latencyMs: report.latencyMs,
    metadata: report.metadata,
    error: report.error,
  };
  if (report.status === 'ok') {
    console.log('[s3-preflight] OK', message);
    return;
  }
  console.warn('[s3-preflight] DEGRADED', message);
}
