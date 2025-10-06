// Назначение: параметры подключения к антивирусу ClamAV
// Модули: process, Number

export interface AntivirusConfig {
  host: string;
  port: number;
  timeout: number;
  chunkSize: number;
  enabled: boolean;
  vendor: 'ClamAV';
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const normalized = Math.trunc(num);
  return normalized > 0 ? normalized : fallback;
}

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  const lowered = value.toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(lowered)) return false;
  if (['1', 'true', 'yes', 'on'].includes(lowered)) return true;
  return fallback;
}

const host = process.env.CLAMAV_HOST || '127.0.0.1';
const port = parsePositiveInt(process.env.CLAMAV_PORT, 3310);
const timeout = parsePositiveInt(process.env.CLAMAV_TIMEOUT, 5000);
const chunkSize = parsePositiveInt(process.env.CLAMAV_CHUNK_SIZE, 64 * 1024);
const enabled = parseBooleanFlag(process.env.ANTIVIRUS_ENABLED, true);

export const antivirusConfig: AntivirusConfig = {
  host,
  port,
  timeout,
  chunkSize,
  enabled,
  vendor: 'ClamAV',
};
