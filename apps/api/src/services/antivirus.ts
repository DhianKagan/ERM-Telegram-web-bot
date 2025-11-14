// Сканирование файлов на вирусы
// Модули: node:crypto, node:fs/promises, clamdjs, config/antivirus, wgLogEngine
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import clamd from 'clamdjs';
import path from 'path';
import { uploadsDir } from '../config/storage';
import type {
  AntivirusConfig,
  ClamAvConfig,
  SignatureConfig,
} from '../config/antivirus';
import { antivirusConfig } from '../config/antivirus';
import { writeLog } from './wgLogEngine';

type ClamScanner = ReturnType<typeof clamd.createScanner>;

let scanner: ClamScanner | null = null;
let versionInfo: string | null = null;
let status: 'idle' | 'available' | 'unavailable' | 'disabled' = 'idle';
let initPromise: Promise<void> | null = null;

/** Привести путь к POSIX-виду: `\` → `/`, `C:/` → `/` */
const toPosixAbs = (p: string) => {
  const forward = p.replace(/\\/g, '/');
  return forward.replace(/^[A-Za-z]:\//, '/');
};

const signatureEntries =
  antivirusConfig.vendor === 'Signature'
    ? Array.from(new Set((antivirusConfig as SignatureConfig).signatures)).map(
        (value) => ({
          value,
          buffer: Buffer.from(value, 'utf-8'),
        }),
      )
    : [];

const signatureVersion =
  antivirusConfig.vendor === 'Signature'
    ? `SignatureSet/${signatureEntries.length}/${createHash('sha256')
        .update(signatureEntries.map((entry) => entry.value).join('|'))
        .digest('hex')
        .slice(0, 8)}`
    : null;

function isClamConfig(config: AntivirusConfig): config is ClamAvConfig {
  return config.vendor === 'ClamAV';
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : JSON.stringify(error);
}

async function logStatus(
  nextStatus: 'available' | 'unavailable' | 'disabled',
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (status === nextStatus) return;
  status = nextStatus;
  const baseMetadata = {
    vendor: antivirusConfig.vendor,
    version: versionInfo ?? undefined,
    ...(isClamConfig(antivirusConfig)
      ? {
          host: antivirusConfig.host,
          port: antivirusConfig.port,
        }
      : {
          signatures: signatureEntries.length,
          maxFileSize: (antivirusConfig as SignatureConfig).maxFileSize,
        }),
    ...metadata,
  };
  if (nextStatus === 'available') {
    await writeLog('Антивирус активирован', 'info', baseMetadata);
  } else if (nextStatus === 'disabled') {
    await writeLog('Антивирус отключён', 'warn', baseMetadata);
  } else {
    await writeLog('Антивирус недоступен', 'warn', baseMetadata);
  }
}

async function ensureScanner(): Promise<void> {
  if (!antivirusConfig.enabled) {
    scanner = null;
    versionInfo = null;
    await logStatus('disabled');
    return;
  }
  if (antivirusConfig.vendor === 'Signature') {
    versionInfo = signatureVersion;
    await logStatus('available');
    return;
  }
  if (scanner) return;
  if (initPromise) {
    await initPromise;
    return;
  }
  initPromise = (async () => {
    try {
      if (!isClamConfig(antivirusConfig)) {
        throw new Error('Конфигурация ClamAV недоступна');
      }
      const alive = await clamd.ping(
        antivirusConfig.host,
        antivirusConfig.port,
        antivirusConfig.timeout,
      );
      if (!alive) {
        throw new Error('ClamAV не ответил на ping');
      }
      scanner = clamd.createScanner(antivirusConfig.host, antivirusConfig.port);
      versionInfo = await clamd
        .version(
          antivirusConfig.host,
          antivirusConfig.port,
          antivirusConfig.timeout,
        )
        .catch(() => null);
      await logStatus('available');
    } catch (error) {
      scanner = null;
      versionInfo = null;
      await logStatus('unavailable', { error: formatError(error) });
    }
  })();
  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
}

export async function scanFile(filePath: string): Promise<boolean> {
  const uploadsRoot = path.resolve(uploadsDir);

  // Абсолютный путь на диске (Windows/Unix)
  const normalizedPath = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(uploadsRoot, filePath);

  // Безопасность: запретить выход за uploads при относительном входе
  if (!path.isAbsolute(filePath)) {
    const relative = path.relative(uploadsRoot, normalizedPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('INVALID_PATH');
    }
  }

  // POSIX-путь для вызовов и логов (нужен для стабильности тестов и кроссплатформенности)
  const posixPath = toPosixAbs(normalizedPath);

  await ensureScanner();

  // Сигнатурный "офлайн" сканер
  if (antivirusConfig.vendor === 'Signature') {
    try {
      const fileStat = await stat(normalizedPath);
      if (fileStat.size > (antivirusConfig as SignatureConfig).maxFileSize) {
        await writeLog(
          'Размер файла превышает лимит сигнатурного сканера',
          'warn',
          {
            path: posixPath,
            vendor: antivirusConfig.vendor,
            size: fileStat.size,
            maxFileSize: (antivirusConfig as SignatureConfig).maxFileSize,
          },
        );
        return false;
      }
      const content = await readFile(normalizedPath);
      const match = signatureEntries.find((entry) =>
        content.includes(entry.buffer),
      );
      if (match) {
        await writeLog('Обнаружен вирус', 'warn', {
          path: posixPath,
          vendor: antivirusConfig.vendor,
          signature: match.value,
        });
        return false;
      }
      return true;
    } catch (error) {
      await writeLog('Ошибка сканирования', 'error', {
        path: posixPath,
        vendor: antivirusConfig.vendor,
        error: formatError(error),
      });
      return false;
    }
  }

  // ClamAV
  if (!scanner || !isClamConfig(antivirusConfig)) return true;
  try {
    const reply = await scanner.scanFile(
      posixPath, // ВАЖНО: POSIX-вид пути
      antivirusConfig.timeout,
      antivirusConfig.chunkSize,
    );
    const clean = clamd.isCleanReply(reply);
    if (!clean) {
      await writeLog('Обнаружен вирус', 'warn', {
        path: posixPath,
        vendor: antivirusConfig.vendor,
        reply,
      });
    }
    return clean;
  } catch (error) {
    // Сбросим состояние, чтобы следующая попытка переинициализировала сканер
    scanner = null;
    versionInfo = null;
    status = 'idle';
    await writeLog('Ошибка сканирования', 'error', {
      path: posixPath,
      vendor: antivirusConfig.vendor,
      error: formatError(error),
    });
    return false;
  }
}
