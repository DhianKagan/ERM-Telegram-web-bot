// Сервис управления файлами в локальном хранилище
// Модули: fs, path, маршруты задач
import fs from 'fs';
import path from 'path';
import { uploadsDir } from '../routes/tasks';

const uploadsDirAbs = path.resolve(uploadsDir);

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
  // Предотвращаем выход за пределы каталога
  const targetPath = path.resolve(uploadsDirAbs, name);
  if (!targetPath.startsWith(uploadsDirAbs + path.sep)) {
    throw new Error('Недопустимое имя файла');
  }
  await fs.promises.unlink(targetPath);
}
