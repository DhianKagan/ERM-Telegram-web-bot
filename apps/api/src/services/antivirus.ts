// Сканирование файлов на вирусы
// Модули: clamdjs, config/antivirus, wgLogEngine
import clamd from 'clamdjs';
import { antivirusConfig } from '../config/antivirus';
import { writeLog } from './wgLogEngine';

type ClamScanner = ReturnType<typeof clamd.createScanner>;

let scanner: ClamScanner | null = null;
let versionInfo: string | null = null;
let status: 'idle' | 'available' | 'unavailable' | 'disabled' = 'idle';
let initPromise: Promise<void> | null = null;

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
    host: antivirusConfig.host,
    port: antivirusConfig.port,
    version: versionInfo ?? undefined,
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
  if (scanner) return;
  if (initPromise) {
    await initPromise;
    return;
  }
  initPromise = (async () => {
    try {
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
        .version(antivirusConfig.host, antivirusConfig.port, antivirusConfig.timeout)
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

export async function scanFile(path: string): Promise<boolean> {
  await ensureScanner();
  if (!scanner) return true;
  try {
    const reply = await scanner.scanFile(
      path,
      antivirusConfig.timeout,
      antivirusConfig.chunkSize,
    );
    const clean = clamd.isCleanReply(reply);
    if (!clean) {
      await writeLog('Обнаружен вирус', 'warn', {
        path,
        vendor: antivirusConfig.vendor,
        reply,
      });
    }
    return clean;
  } catch (error) {
    scanner = null;
    versionInfo = null;
    status = 'idle';
    await writeLog('Ошибка сканирования', 'error', {
      path,
      vendor: antivirusConfig.vendor,
      error: formatError(error),
    });
    return false;
  }
}
