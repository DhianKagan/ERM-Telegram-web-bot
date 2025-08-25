// Сканирование файлов на вирусы
// Модули: clamscan, wgLogEngine
import NodeClam from 'clamscan';
import { writeLog } from './wgLogEngine';

interface ClamInstance {
  scanFile(p: string): Promise<{ isInfected: boolean }>;
}
let scanner: ClamInstance | null = null;

async function ensureScanner(): Promise<void> {
  if (!scanner) {
    try {
      const clam = await new (NodeClam as unknown as {
        new (): { init(): Promise<unknown> };
      })().init();
      scanner = clam as ClamInstance;
    } catch {
      scanner = null;
      await writeLog('Антивирус недоступен', 'warn');
    }
  }
}

export async function scanFile(path: string): Promise<boolean> {
  await ensureScanner();
  if (!scanner) return true;
  try {
    const res = await scanner.scanFile(path);
    if (res.isInfected) {
      await writeLog('Обнаружен вирус', 'warn', { path });
      return false;
    }
    return true;
  } catch {
    await writeLog('Ошибка сканирования', 'error', { path });
    return false;
  }
}
