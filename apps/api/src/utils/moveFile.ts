// Назначение файла: безопасное перемещение файлов с учётом ограничений файловой системы.
// Основные модули: node:fs/promises, node:path
import fs from 'node:fs/promises';
import path from 'node:path';

const CROSS_DEVICE_ERROR_CODE = 'EXDEV';

const ensureDirectory = async (targetPath: string): Promise<void> => {
  const dir = path.dirname(targetPath);
  await fs.mkdir(dir, { recursive: true });
};

const moveAcrossDevices = async (
  source: string,
  destination: string,
): Promise<void> => {
  await ensureDirectory(destination);
  await fs.copyFile(source, destination);
  await fs.unlink(source);
};

export const moveFile = async (
  source: string,
  destination: string,
): Promise<void> => {
  try {
    await ensureDirectory(destination);
    await fs.rename(source, destination);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === CROSS_DEVICE_ERROR_CODE) {
      await moveAcrossDevices(source, destination);
      return;
    }
    throw error;
  }
};
