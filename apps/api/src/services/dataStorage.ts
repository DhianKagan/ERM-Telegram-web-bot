// Сервис управления файлами в локальном хранилище
// Модули: fs, path, mongoose
import fs from 'fs';
import path from 'path';
import type { FilterQuery, Types } from 'mongoose';

import { uploadsDir } from '../config/storage';
import { File, Task, type FileDocument } from '../db/model';

const uploadsDirAbs = path.resolve(uploadsDir);

export interface StoredFile {
  taskId?: string;
  userId: number;
  name: string;
  path: string;
  thumbnailUrl?: string;
  type: string;
  size: number;
  uploadedAt: Date;
  url: string;
  previewUrl: string;
  taskNumber?: string;
  taskTitle?: string;
}

export async function listFiles(
  filters: { userId?: number; type?: string } = {},
): Promise<StoredFile[]> {
  try {
    const query: FilterQuery<FileDocument> = {};
    if (filters.userId !== undefined) query.userId = filters.userId;
    if (typeof filters.type === 'string') query.type = { $eq: filters.type };
    const files = await File.find(query).lean();
    const taskIds = files
      .map((file) => file.taskId)
      .filter((id): id is Types.ObjectId => Boolean(id));
    const taskMap = new Map<
      string,
      { title?: string | null; number?: string | null }
    >();
    if (taskIds.length > 0) {
      const tasks = await Task.find({ _id: { $in: taskIds } })
        .select(['_id', 'task_number', 'title'])
        .lean();
      tasks.forEach((task) => {
        taskMap.set(String(task._id), {
          title: task.title,
          number: task.task_number,
        });
      });
    }
    return files.map((f) => {
      const taskId = f.taskId ? String(f.taskId) : undefined;
      const taskMeta = taskId ? taskMap.get(taskId) : undefined;
      return {
        taskId,
        taskNumber: taskMeta?.number ?? undefined,
        taskTitle:
          typeof taskMeta?.title === 'string' && taskMeta.title.trim()
            ? taskMeta.title
            : undefined,
        userId: f.userId,
        name: f.name,
        path: f.path,
        thumbnailUrl: f.thumbnailPath
          ? `/uploads/${f.thumbnailPath}`
          : undefined,
        type: f.type,
        size: f.size,
        uploadedAt: f.uploadedAt,
        url: `/api/v1/files/${String(f._id)}`,
        previewUrl: `/api/v1/files/${String(f._id)}?mode=inline`,
      } satisfies StoredFile;
    });
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
          attachments: { url: `/api/v1/files/${file._id}` },
          files: `/api/v1/files/${file._id}`,
        },
      },
    ).exec();
  }
}
