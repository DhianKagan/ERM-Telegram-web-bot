// Безопасное перемещение файлов между файловыми системами.
// Основные модули: node:path, node:fs/promises.
import { dirname } from 'node:path';
import { copyFile, mkdir, unlink } from 'node:fs/promises';

export const safeMoveFile = async (src: string, dest: string): Promise<void> => {
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(src, dest);
  try {
    await unlink(src);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
};
