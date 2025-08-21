// Сервис управления файлами в локальном хранилище
// Модули: fs, path, маршруты задач
import fs from 'fs';
import path from 'path';
import { uploadsDir } from '../config/storage';

const uploadsDirAbs = path.resolve(uploadsDir);

export interface StoredFile {
  name: string;
  size: number;
  url: string;
}

export async function listFiles(): Promise<StoredFile[]> {
  try {
    const names = await fs.promises.readdir(uploadsDir);
    const files = await Promise.all(
      names.map(async (name) => {
        const stat = await fs.promises.stat(path.join(uploadsDir, name));
        return { name, size: stat.size, url: `/uploads/${name}` };
      }),
    );
    return files;
  } catch {
    return [];
  }
}

export async function deleteFile(name: string): Promise<void> {
  // Предотвращаем выход за пределы каталога
  const targetPath = path.resolve(uploadsDirAbs, name);
  if (!targetPath.startsWith(uploadsDirAbs + path.sep)) {
    throw new Error('Недопустимое имя файла');
  }
  await fs.promises.unlink(targetPath);
}
