// Назначение: параметры подключения к антивирусу
// Модули: process, Number

export type AntivirusVendor = 'ClamAV' | 'Signature';

interface AntivirusBaseConfig {
  enabled: boolean;
  vendor: AntivirusVendor;
}

export interface ClamAvConfig extends AntivirusBaseConfig {
  vendor: 'ClamAV';
  host: string;
  port: number;
  timeout: number;
  chunkSize: number;
}

export interface SignatureConfig extends AntivirusBaseConfig {
  vendor: 'Signature';
  maxFileSize: number;
  signatures: string[];
}

export type AntivirusConfig = ClamAvConfig | SignatureConfig;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const normalized = Math.trunc(num);
  return normalized > 0 ? normalized : fallback;
}

function parseSizeLimit(value: string | undefined, fallback: number): number {
  const parsed = parsePositiveInt(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  const lowered = value.toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(lowered)) return false;
  if (['1', 'true', 'yes', 'on'].includes(lowered)) return true;
  return fallback;
}

function parseVendor(value: string | undefined): AntivirusVendor {
  if (!value) return 'Signature';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'clamav') return 'ClamAV';
  if (normalized === 'signature') return 'Signature';
  return 'Signature';
}

function parseSignatures(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const enabled = parseBooleanFlag(process.env.ANTIVIRUS_ENABLED, true);
const vendor = parseVendor(process.env.ANTIVIRUS_VENDOR);

if (vendor === 'ClamAV') {
  const host = process.env.CLAMAV_HOST || '127.0.0.1';
  const port = parsePositiveInt(process.env.CLAMAV_PORT, 3310);
  const timeout = parsePositiveInt(process.env.CLAMAV_TIMEOUT, 5000);
  const chunkSize = parsePositiveInt(process.env.CLAMAV_CHUNK_SIZE, 64 * 1024);

  export const antivirusConfig: AntivirusConfig = {
    vendor,
    enabled,
    host,
    port,
    timeout,
    chunkSize,
  };
} else {
  const maxFileSize = parseSizeLimit(process.env.ANTIVIRUS_SIGNATURE_MAX_SIZE, 20 * 1024 * 1024);
  const customSignatures = parseSignatures(process.env.ANTIVIRUS_SIGNATURES);
  const defaultSignatures = [
    'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
  ];
  const signatures = customSignatures.length > 0 ? customSignatures : defaultSignatures;

  export const antivirusConfig: AntivirusConfig = {
    vendor,
    enabled,
    maxFileSize,
    signatures,
  };
}
