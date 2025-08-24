// Сервис управления файлами в локальном хранилище
// Модули: fs, path, mongoose
import fs from 'fs';
import path from 'path';
import type { FilterQuery } from 'mongoose';

import { uploadsDir } from '../config/storage';
import { File, Task, type FileDocument } from '../db/model';

const uploadsDirAbs = path.resolve(uploadsDir);

export interface StoredFile {
  taskId?: string;
  userId: number;
  name: string;
  path: string;
  type: string;
  size: number;
  uploadedAt: Date;
  url: string;
}

export async function listFiles(
  filters: { userId?: number; type?: string } = {},
): Promise<StoredFile[]> {
  try {
    const query: FilterQuery<FileDocument> = {};
    if (filters.userId !== undefined) query.userId = filters.userId;
    if (typeof filters.type === 'string') query.type = { $eq: filters.type };
    const files = await File.find(query).lean();
    return files.map((f) => ({
      taskId: f.taskId ? String(f.taskId) : undefined,
      userId: f.userId,
      name: f.name,
      path: f.path,
      type: f.type,
      size: f.size,
      uploadedAt: f.uploadedAt,
      url: `/uploads/${f.path}`,
    }));
  } catch {
    return [];
  }
}

export async function deleteFile(name: string): Promise<void> {
  const file = await File.findOneAndDelete({ path: name }).lean();
  if (!file) {
    const err = new Error('Файл не найден') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    throw err;
  }
  const targetPath = path.resolve(uploadsDirAbs, file.path);
  if (!targetPath.startsWith(uploadsDirAbs + path.sep)) {
    throw new Error('Недопустимое имя файла');
  }
  await fs.promises.unlink(targetPath).catch((e: NodeJS.ErrnoException) => {
    if (e.code !== 'ENOENT') throw e;
  });
  if (file.taskId) {
    await Task.updateOne(
      { _id: file.taskId },
      {
        $pull: {
          attachments: { url: `/uploads/${file.path}` },
          files: `/uploads/${file.path}`,
        },
      },
    ).exec();
  }
}
