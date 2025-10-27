// Сервис управления файлами в локальном хранилище
// Модули: fs, path, mongoose
import fs from 'fs';
import path from 'path';
import type { FilterQuery } from 'mongoose';
import { Types } from 'mongoose';

import { uploadsDir } from '../config/storage';
import {
  File,
  Task,
  type Attachment,
  type FileDocument,
} from '../db/model';
import { extractAttachmentIds } from '../utils/attachments';

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

const TASK_URL_SUFFIX = '(?:[/?#].*|$)';

const buildAttachmentQuery = (
  ids: string[],
):
  | { $or: Array<{ 'attachments.url': { $regex: RegExp } }> }
  | null => {
  if (ids.length === 0) return null;
  const orConditions = ids.map((id) => ({
    'attachments.url': {
      $regex: new RegExp(`/${id}${TASK_URL_SUFFIX}`),
    },
  }));
  return { $or: orConditions };
};

const normalizeTitle = (value?: string | null) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toObjectId = (
  value: string | Types.ObjectId,
): Types.ObjectId | null => {
  if (value instanceof Types.ObjectId) {
    return value;
  }
  if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
    return new Types.ObjectId(value);
  }
  return null;
};

const persistTaskLink = async (
  fileId: Types.ObjectId | string,
  taskId: string | Types.ObjectId,
): Promise<void> => {
  const normalizedTaskId = toObjectId(taskId);
  if (!normalizedTaskId) {
    console.error('Не удалось сохранить привязку файла к задаче', {
      fileId: String(fileId),
      taskId: String(taskId),
      error: new Error('Некорректный идентификатор задачи'),
    });
    return;
  }
  try {
    await File.updateOne(
      { _id: fileId },
      { $set: { taskId: normalizedTaskId } },
    ).exec();
  } catch (error) {
    console.error('Не удалось сохранить привязку файла к задаче', {
      fileId: String(fileId),
      taskId: normalizedTaskId.toHexString(),
      error,
    });
  }
};

export const collectAttachmentLinks = async (
  candidates: Array<{
    id: string;
    hasTask: boolean;
  }>,
): Promise<
  Map<string, { taskId: string; number?: string | null; title?: string | null }>
> => {
  const pendingIds = candidates
    .filter((file) => !file.hasTask)
    .map((file) => file.id);
  if (!pendingIds.length) {
    return new Map();
  }
  const query = buildAttachmentQuery(pendingIds);
  if (!query) {
    return new Map();
  }
  const tasks = await Task.find(query)
    .select(['_id', 'task_number', 'title', 'attachments'])
    .lean();
  const lookup = new Map<
    string,
    { taskId: string; number?: string | null; title?: string | null }
  >();
  if (!tasks.length) return lookup;
  const available = new Set(pendingIds);
  tasks.forEach((task) => {
    const attachments = extractAttachmentIds(
      (task.attachments as Attachment[] | undefined) ?? [],
    );
    attachments.forEach((attachmentId) => {
      const key = attachmentId.toHexString();
      if (!available.has(key) || lookup.has(key)) return;
      lookup.set(key, {
        taskId: String(task._id),
        number: task.task_number,
        title: task.title,
      });
    });
  });
  return lookup;
};

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
    const candidates = files.map((file) => ({
      id: String(file._id),
      hasTask: Boolean(file.taskId),
    }));
    const attachmentsLookup = await collectAttachmentLinks(candidates);
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
    const updates: Promise<void>[] = [];
    const result: StoredFile[] = [];
    for (const f of files) {
      let taskId = f.taskId ? String(f.taskId) : undefined;
      let taskMeta = taskId ? taskMap.get(taskId) : undefined;
      if (!taskId) {
        const fallback = attachmentsLookup.get(String(f._id));
        if (fallback) {
          taskId = fallback.taskId;
          taskMeta = { title: fallback.title, number: fallback.number };
          updates.push(
            persistTaskLink(f._id as Types.ObjectId, fallback.taskId),
          );
        }
      }
      result.push({
        id: String(f._id),
        taskId,
        taskNumber: taskMeta?.number ?? undefined,
        taskTitle: normalizeTitle(taskMeta?.title),
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
      } satisfies StoredFile);
    }
    if (updates.length > 0) {
      await Promise.all(updates);
    }
    return result;
  } catch {
    return [];
  }
}

export async function getFile(id: string): Promise<StoredFile | null> {
  const doc = await File.findById(id).lean();
  if (!doc) {
    return null;
  }
  let taskId = doc.taskId ? String(doc.taskId) : undefined;
  let taskMeta: { task_number?: string | null; title?: string | null } | null =
    null;
  if (taskId) {
    taskMeta = await Task.findById(doc.taskId)
      .select(['task_number', 'title'])
      .lean();
  } else {
    const fallbackQuery = buildAttachmentQuery([String(doc._id)]);
    if (fallbackQuery) {
      const fallback = await Task.findOne(fallbackQuery)
        .select(['_id', 'task_number', 'title', 'attachments'])
        .lean();
      if (fallback) {
        const attachments = extractAttachmentIds(
          (fallback.attachments as Attachment[] | undefined) ?? [],
        );
        const matched = attachments.some((entry) =>
          entry.equals(doc._id as Types.ObjectId),
        );
        if (matched) {
          taskId = String(fallback._id);
          taskMeta = fallback;
          await persistTaskLink(
            doc._id as Types.ObjectId,
            fallback._id as Types.ObjectId,
          );
        }
      }
    }
  }
  return {
    id: String(doc._id),
    taskId,
    taskNumber: taskMeta?.task_number ?? undefined,
    taskTitle: normalizeTitle(taskMeta?.title),
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
