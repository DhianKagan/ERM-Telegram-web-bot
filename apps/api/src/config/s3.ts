// Назначение: загрузка и валидация S3-конфигурации из переменных окружения.
// Основные модули: process

const requiredVars = [
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_FORCE_PATH_STYLE',
  'S3_USE_SSL',
] as const;

type RequiredS3Var = (typeof requiredVars)[number];

export type S3RuntimeConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  useSsl: boolean;
};

export type S3ConfigValidation = {
  ok: boolean;
  config: S3RuntimeConfig | null;
  missing: RequiredS3Var[];
  invalid: RequiredS3Var[];
};

const normalize = (value: string | undefined): string => {
  if (!value) {
    return '';
  }
  return value.trim();
};

const parseBooleanEnv = (value: string): boolean | null => {
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return null;
};

export function readS3Config(): S3ConfigValidation {
  const missing: RequiredS3Var[] = [];
  const invalid: RequiredS3Var[] = [];

  const values = requiredVars.reduce<Record<RequiredS3Var, string>>(
    (acc, key) => {
      const current = normalize(process.env[key]);
      if (!current) {
        missing.push(key);
      }
      acc[key] = current;
      return acc;
    },
    {} as Record<RequiredS3Var, string>,
  );

  const forcePathStyle = parseBooleanEnv(values.S3_FORCE_PATH_STYLE);
  const useSsl = parseBooleanEnv(values.S3_USE_SSL);

  if (forcePathStyle === null && values.S3_FORCE_PATH_STYLE) {
    invalid.push('S3_FORCE_PATH_STYLE');
  }
  if (useSsl === null && values.S3_USE_SSL) {
    invalid.push('S3_USE_SSL');
  }

  if (
    missing.length ||
    invalid.length ||
    forcePathStyle === null ||
    useSsl === null
  ) {
    return {
      ok: false,
      config: null,
      missing,
      invalid,
    };
  }

  return {
    ok: true,
    missing,
    invalid,
    config: {
      endpoint: values.S3_ENDPOINT,
      region: values.S3_REGION,
      bucket: values.S3_BUCKET,
      accessKeyId: values.S3_ACCESS_KEY_ID,
      secretAccessKey: values.S3_SECRET_ACCESS_KEY,
      forcePathStyle,
      useSsl,
    },
  };
}

export type S3SafeMetadata = {
  endpoint: string;
  region: string;
  bucket: string;
  forcePathStyle: boolean;
  useSsl: boolean;
};

export function toS3SafeMetadata(config: S3RuntimeConfig): S3SafeMetadata {
  return {
    endpoint: config.endpoint,
    region: config.region,
    bucket: config.bucket,
    forcePathStyle: config.forcePathStyle,
    useSsl: config.useSsl,
  };
}
