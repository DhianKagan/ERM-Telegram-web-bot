// Сервис управления файлами в локальном хранилище
// Модули: fs, path, mongoose
import fs from 'fs';
import path from 'path';
import type { FilterQuery } from 'mongoose';
import { Types } from 'mongoose';

import { uploadsDir } from '../config/storage';
import { File, Task, type Attachment, type FileDocument } from '../db/model';
import {
  extractAttachmentIds,
  extractFileIdFromUrl,
} from '../utils/attachments';
import {
  buildFileUrl,
  buildInlineFileUrl,
  buildThumbnailUrl,
} from '../utils/fileUrls';

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
): {
  $or: Array<
    | { 'attachments.url': { $regex: RegExp } }
    | { files: { $elemMatch: { $regex: RegExp } } }
  >;
} | null => {
  if (ids.length === 0) return null;
  const orConditions = ids.flatMap((id) => {
    const pattern = new RegExp(`/${id}${TASK_URL_SUFFIX}`, 'i');
    return [
      {
        'attachments.url': {
          $regex: pattern,
        },
      },
      {
        files: {
          $elemMatch: {
            $regex: pattern,
          },
        },
      },
    ];
  });
  return { $or: orConditions };
};

const HEX_OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const normalizeObjectIdString = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!HEX_OBJECT_ID.test(trimmed)) return null;
  return Types.ObjectId.isValid(trimmed) ? trimmed.toLowerCase() : null;
};

const collectIdsFromString = (value: string): string[] => {
  const normalized = value.trim();
  if (!normalized) {
    return [];
  }
  const result = new Set<string>();
  const fromUrl = extractFileIdFromUrl(normalized);
  if (fromUrl) {
    result.add(fromUrl.toLowerCase());
  }
  if (normalized.length === 24) {
    const direct = normalizeObjectIdString(normalized);
    if (direct) {
      result.add(direct);
    }
  }
  const matches = normalized.match(/[0-9a-fA-F]{24}/g);
  if (matches) {
    matches.forEach((candidate) => {
      const converted = normalizeObjectIdString(candidate);
      if (converted) {
        result.add(converted);
      }
    });
  }
  return Array.from(result.values());
};

const normalizeLookupId = (value: unknown): string | null => {
  if (value instanceof Types.ObjectId) {
    return value.toHexString();
  }
  if (typeof value === 'string') {
    const direct = normalizeObjectIdString(value);
    if (direct) {
      return direct;
    }
    const extracted = collectIdsFromString(value);
    if (extracted.length > 0) {
      return extracted[0] ?? null;
    }
  }
  return null;
};

const collectTaskFileReferences = (task: {
  attachments?: Attachment[] | null;
  files?: unknown;
}): Set<string> => {
  const references = new Set<string>();
  const attachmentIds = extractAttachmentIds(
    (task.attachments as Attachment[] | undefined) ?? [],
  );
  attachmentIds.forEach((entry) => references.add(entry.toHexString()));
  if (Array.isArray(task.files)) {
    task.files.forEach((item) => {
      if (typeof item !== 'string') return;
      collectIdsFromString(item).forEach((id) => references.add(id));
    });
  }
  return references;
};

const normalizeTitle = (value?: string | null) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toObjectId = (value: string | Types.ObjectId): Types.ObjectId | null => {
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
  const normalizedCandidates = candidates
    .map((candidate) => ({
      id: normalizeLookupId(candidate.id),
      hasTask: candidate.hasTask,
    }))
    .filter(
      (candidate): candidate is { id: string; hasTask: boolean } =>
        candidate.id !== null,
    );
  const pendingIds = normalizedCandidates
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
    .select(['_id', 'task_number', 'title', 'attachments', 'files'])
    .lean();
  const lookup = new Map<
    string,
    { taskId: string; number?: string | null; title?: string | null }
  >();
  if (!tasks.length) return lookup;
  const available = new Set(pendingIds);
  tasks.forEach((task) => {
    const references = collectTaskFileReferences(
      task as {
        attachments?: Attachment[] | null;
        files?: unknown;
      },
    );
    references.forEach((key) => {
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
    const candidates = files
      .map((file) => {
        const normalizedId = normalizeLookupId(file._id);
        if (!normalizedId) {
          return null;
        }
        return {
          id: normalizedId,
          hasTask: Boolean(file.taskId),
        };
      })
      .filter(
        (candidate): candidate is { id: string; hasTask: boolean } =>
          candidate !== null,
      );
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
        const normalizedFileId = normalizeLookupId(f._id);
        const fallback = normalizedFileId
          ? attachmentsLookup.get(normalizedFileId)
          : undefined;
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
        thumbnailUrl: f.thumbnailPath ? buildThumbnailUrl(f._id) : undefined,
        type: f.type,
        size: f.size,
        uploadedAt: f.uploadedAt,
        url: buildFileUrl(f._id),
        previewUrl: buildInlineFileUrl(f._id),
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
        .select(['_id', 'task_number', 'title', 'attachments', 'files'])
        .lean();
      if (fallback) {
        const references = collectTaskFileReferences(
          fallback as {
            attachments?: Attachment[] | null;
            files?: unknown;
          },
        );
        const key = normalizeLookupId(doc._id);
        if (key && references.has(key)) {
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
    thumbnailUrl: doc.thumbnailPath ? buildThumbnailUrl(doc._id) : undefined,
    type: doc.type,
    size: doc.size,
    uploadedAt: doc.uploadedAt,
    url: buildFileUrl(doc._id),
    previewUrl: buildInlineFileUrl(doc._id),
  } satisfies StoredFile;
}

export interface DeleteFileResult {
  taskId?: string;
  attachments?: Attachment[];
}

export async function deleteFile(
  identifier: string,
): Promise<DeleteFileResult | undefined> {
  const query: FilterQuery<FileDocument> = /^[0-9a-fA-F]{24}$/.test(identifier)
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
  let updatedAttachments: Attachment[] | undefined;
  let taskIdHex: string | undefined;
  if (file.taskId) {
    taskIdHex =
      typeof file.taskId === 'string'
        ? file.taskId
        : file.taskId instanceof Types.ObjectId
          ? file.taskId.toHexString()
          : undefined;
    const updatedTask = await Task.findByIdAndUpdate(
      file.taskId,
      {
        $pull: {
          attachments: { url: `/api/v1/files/${file._id}` },
          files: `/api/v1/files/${file._id}`,
        },
      },
      { new: true, projection: { attachments: 1 } },
    )
      .lean<{ attachments?: Attachment[] }>()
      .exec();
    if (updatedTask?.attachments && Array.isArray(updatedTask.attachments)) {
      updatedAttachments = updatedTask.attachments;
    }
  }
  if (taskIdHex) {
    return { taskId: taskIdHex, attachments: updatedAttachments };
  }
  return undefined;
}

export async function deleteFilesForTask(
  taskId: Types.ObjectId | string,
  extraFileIds: Types.ObjectId[] = [],
): Promise<void> {
  const normalizedTaskId =
    typeof taskId === 'string' ? new Types.ObjectId(taskId) : taskId;
  const uniqueExtraIds = Array.from(
    new Set(extraFileIds.map((id) => id.toHexString())),
  ).map((id) => new Types.ObjectId(id));
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

const detachedCleanupFilter: FilterQuery<FileDocument> = {
  $and: [
    { $or: [{ taskId: null }, { taskId: { $exists: false } }] },
    { $or: [{ draftId: null }, { draftId: { $exists: false } }] },
  ],
};

export async function removeDetachedFilesOlderThan(
  cutoff: Date,
): Promise<number> {
  const cutoffTime = cutoff.getTime();
  if (!Number.isFinite(cutoffTime)) {
    return 0;
  }
  const filter: FilterQuery<FileDocument> = {
    ...detachedCleanupFilter,
    uploadedAt: { $lte: new Date(cutoffTime) },
  };
  const candidates = await File.find(filter)
    .select(['_id', 'path', 'thumbnailPath'])
    .lean();
  if (candidates.length === 0) {
    return 0;
  }
  await Promise.all(
    candidates.map(async (file) => {
      await unlinkWithinUploads(file.path);
      await unlinkWithinUploads(file.thumbnailPath);
    }),
  );
  await File.deleteMany({
    _id: { $in: candidates.map((file) => file._id) },
  }).exec();
  return candidates.length;
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
