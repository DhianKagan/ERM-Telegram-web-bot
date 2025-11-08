// Назначение: хранение таймстемпа троттлинга метода close Telegram между перезапусками бота.
// Основные модули: fs, path, os.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const STORE_DIRECTORY = path.join(os.tmpdir(), 'erm-telegram-bot');
const STORE_FILENAME = 'closeThrottle.json';
const STORE_PATH = path.join(STORE_DIRECTORY, STORE_FILENAME);

type CloseThrottlePayload = {
  closeThrottleUntil: number;
};

const readStoreSafely = (): number => {
  try {
    const buffer = fs.readFileSync(STORE_PATH, 'utf8');
    const payload = JSON.parse(buffer) as Partial<CloseThrottlePayload>;
    const value = Number(payload.closeThrottleUntil);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error) {
      const { code } = error as { code?: string };
      if (code === 'ENOENT') {
        return 0;
      }
    }
    console.warn('Не удалось прочитать значение троттла метода close из хранилища', error);
    return 0;
  }
};

const ensureDirectoryExists = (): void => {
  try {
    fs.mkdirSync(STORE_DIRECTORY, { recursive: true });
  } catch (error) {
    console.warn('Не удалось создать каталог для хранения троттла метода close', error);
  }
};

export const getCloseThrottleUntil = (): number => readStoreSafely();

export const updateCloseThrottleUntil = (timestamp: number): void => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    resetCloseThrottle();
    return;
  }
  ensureDirectoryExists();
  const payload: CloseThrottlePayload = {
    closeThrottleUntil: Math.floor(timestamp),
  };
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(payload));
  } catch (error) {
    console.warn('Не удалось записать значение троттла метода close в хранилище', error);
  }
};

export const resetCloseThrottle = (): void => {
  try {
    fs.rmSync(STORE_PATH, { force: true });
  } catch (error) {
    console.warn('Не удалось удалить значение троттла метода close из хранилища', error);
  }
};
