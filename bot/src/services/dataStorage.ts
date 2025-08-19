// Сервис управления файлами в локальном хранилище
// Модули: fs, path, маршруты задач
import fs from 'fs';
import path from 'path';
import { uploadsDir } from '../routes/tasks';

export interface StoredFile {
  name: string;
  size: number;
  url: string;
}

export async function listFiles(): Promise<StoredFile[]> {
  const files = await fs.promises.readdir(uploadsDir);
  return files.map((name) => {
    const stat = fs.statSync(path.join(uploadsDir, name));
    return { name, size: stat.size, url: `/uploads/${name}` };
  });
}

export async function deleteFile(name: string): Promise<void> {
  await fs.promises.unlink(path.join(uploadsDir, name));
}
