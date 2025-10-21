// Сервис управления файлами в локальном хранилище
// Модули: fs, path, mongoose
import fs from 'fs';
import path from 'path';
import type { FilterQuery } from 'mongoose';
import { Types } from 'mongoose';

import { uploadsDir } from '../config/storage';
import { File, Task, type FileDocument } from '../db/model';

const uploadsDirAbs = path.resolve(uploadsDir);

const resolveWithinUploads = (relative: string): string => {
  const targetPath = path.resolve(uploadsDirAbs, relative);
  if (!targetPath.startsWith(uploadsDirAbs + path.sep)) {
    throw new Error('Недопустимое имя файла');
  }
  return targetPath;
};

const unlinkWithinUploads = async (relative?: string | null): Promise<void> => {
  if (!relative) return;
  const target = resolveWithinUploads(relative);
  await fs.promises.unlink(target).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
};

export interface StoredFile {
  id: string;
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
        id: String(f._id),
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

export async function getFile(id: string): Promise<StoredFile | null> {
  const doc = await File.findById(id).lean();
  if (!doc) {
    return null;
  }
  const taskId = doc.taskId ? String(doc.taskId) : undefined;
  const taskMeta = taskId
    ? await Task.findById(doc.taskId)
        .select(['task_number', 'title'])
        .lean()
    : null;
  return {
    id: String(doc._id),
    taskId,
    taskNumber: taskMeta?.task_number ?? undefined,
    taskTitle:
      typeof taskMeta?.title === 'string' && taskMeta.title.trim()
        ? taskMeta.title
        : undefined,
    userId: doc.userId,
    name: doc.name,
    path: doc.path,
    thumbnailUrl: doc.thumbnailPath
      ? `/uploads/${doc.thumbnailPath}`
      : undefined,
    type: doc.type,
    size: doc.size,
    uploadedAt: doc.uploadedAt,
    url: `/api/v1/files/${String(doc._id)}`,
    previewUrl: `/api/v1/files/${String(doc._id)}?mode=inline`,
  } satisfies StoredFile;
}

export async function deleteFile(identifier: string): Promise<void> {
  const query: FilterQuery<FileDocument> =
    /^[0-9a-fA-F]{24}$/.test(identifier)
      ? { _id: identifier }
      : { path: identifier };
  const file = await File.findOneAndDelete(query).lean();
  if (!file) {
    const err = new Error('Файл не найден') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    throw err;
  }
  await unlinkWithinUploads(file.path);
  await unlinkWithinUploads(file.thumbnailPath);
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

export async function deleteFilesForTask(
  taskId: Types.ObjectId | string,
  extraFileIds: Types.ObjectId[] = [],
): Promise<void> {
  const normalizedTaskId =
    typeof taskId === 'string' ? new Types.ObjectId(taskId) : taskId;
  const uniqueExtraIds = Array.from(new Set(extraFileIds.map((id) => id.toHexString()))).map(
    (id) => new Types.ObjectId(id),
  );
  const orConditions: FilterQuery<FileDocument>[] = [
    { taskId: normalizedTaskId },
  ];
  if (uniqueExtraIds.length > 0) {
    orConditions.push({ _id: { $in: uniqueExtraIds } });
  }
  const filter: FilterQuery<FileDocument> =
    orConditions.length === 1 ? orConditions[0] : { $or: orConditions };
  const files = await File.find(filter).lean();
  if (files.length === 0) return;
  await Promise.all(
    files.map(async (file) => {
      await unlinkWithinUploads(file.path);
      await unlinkWithinUploads(file.thumbnailPath);
    }),
  );
  await File.deleteMany({ _id: { $in: files.map((file) => file._id) } }).exec();
}

export interface FileSyncSnapshot {
  totalFiles: number;
  linkedFiles: number;
  detachedFiles: number;
}

export async function getFileSyncSnapshot(): Promise<FileSyncSnapshot> {
  const [totalFiles, linkedFiles] = await Promise.all([
    File.countDocuments().exec(),
    File.countDocuments({ taskId: { $ne: null } }).exec(),
  ]);
  return {
    totalFiles,
    linkedFiles,
    detachedFiles: Math.max(totalFiles - linkedFiles, 0),
  } satisfies FileSyncSnapshot;
}
