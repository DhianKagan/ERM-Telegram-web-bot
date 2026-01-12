// Сервис работы с файлами (загрузка/получение/удаление/привязка)
// Модули: fs, path, mongoose, services/dataStorage
import path from 'node:path';
import type { FilterQuery, Types } from 'mongoose';
import { Types as MongooseTypes } from 'mongoose';

import { File, Task, type Attachment, type FileDocument } from '../db/model';
import { uploadsDir } from '../config/storage';
import {
  buildFileUrl,
  buildInlineFileUrl,
  buildThumbnailUrl,
} from '../utils/fileUrls';
import {
  collectAttachmentLinks,
  deleteFile,
  deleteFilesForTask,
  getFile,
  getFileSyncSnapshot,
  listFiles,
  removeDetachedFilesOlderThan,
} from './dataStorage';

export type FileScope = 'task' | 'draft' | 'user' | 'telegram';

export type FileRecord = FileDocument & {
  _id: Types.ObjectId;
};

export type CreateFilePayload = {
  userId: number;
  name: string;
  path: string;
  thumbnailPath?: string;
  type: string;
  size: number;
  taskId?: string | Types.ObjectId;
  draftId?: string | Types.ObjectId;
  relatedTaskIds?: Array<string | Types.ObjectId>;
  telegramFileId?: string;
  scope?: FileScope;
  detached?: boolean;
};

const uploadsDirAbs = path.resolve(uploadsDir);

const toObjectId = (value?: string | Types.ObjectId): Types.ObjectId | null => {
  if (!value) return null;
  if (value instanceof MongooseTypes.ObjectId) {
    return value;
  }
  if (MongooseTypes.ObjectId.isValid(value)) {
    return new MongooseTypes.ObjectId(value);
  }
  return null;
};

const inferScope = (payload: CreateFilePayload): FileScope => {
  if (payload.scope) return payload.scope;
  if (payload.taskId) return 'task';
  if (payload.draftId) return 'draft';
  if (payload.telegramFileId) return 'telegram';
  return 'user';
};

const normalizeRelatedTaskIds = (
  taskId?: string | Types.ObjectId,
  relatedTaskIds?: Array<string | Types.ObjectId>,
): Types.ObjectId[] => {
  const normalized = new Map<string, Types.ObjectId>();
  const add = (value?: string | Types.ObjectId) => {
    const converted = toObjectId(value);
    if (!converted) return;
    normalized.set(converted.toHexString(), converted);
  };
  add(taskId);
  (relatedTaskIds ?? []).forEach(add);
  return Array.from(normalized.values());
};

export const createFileRecord = async (
  payload: CreateFilePayload,
): Promise<FileRecord> => {
  const scope = inferScope(payload);
  const relatedTaskIds = normalizeRelatedTaskIds(
    payload.taskId,
    payload.relatedTaskIds,
  );
  const detached = payload.detached ?? (!payload.taskId && !payload.draftId);
  const doc = await File.create({
    userId: payload.userId,
    name: payload.name,
    path: payload.path,
    thumbnailPath: payload.thumbnailPath,
    type: payload.type,
    size: payload.size,
    taskId: payload.taskId ?? null,
    draftId: payload.draftId ?? null,
    relatedTaskIds,
    telegramFileId: payload.telegramFileId,
    scope,
    detached,
  });
  return doc as FileRecord;
};

export const getFileRecord = async (id: string): Promise<FileRecord | null> => {
  const record = await File.findById(id).lean<FileRecord | null>();
  return record ?? null;
};

export const setTelegramFileId = async (
  id: string,
  telegramFileId: string,
): Promise<void> => {
  const trimmed = telegramFileId.trim();
  if (!trimmed || !MongooseTypes.ObjectId.isValid(id)) {
    return;
  }
  await File.updateOne(
    { _id: id },
    { $set: { telegramFileId: trimmed } },
  ).exec();
};

export type StaleFileEntry = {
  _id: Types.ObjectId;
  path: string;
  thumbnailPath?: string | null;
};

export const findStaleUserFiles = async (
  userId: number,
  cutoff: Date,
): Promise<StaleFileEntry[]> => {
  return File.find(
    {
      userId,
      taskId: null,
      draftId: null,
      uploadedAt: { $lte: cutoff },
    },
    { path: 1, thumbnailPath: 1 },
  ).lean<StaleFileEntry[]>();
};

export const deleteFilesByIds = async (
  ids: Types.ObjectId[],
): Promise<void> => {
  if (!ids.length) return;
  await File.deleteMany({ _id: { $in: ids } }).exec();
};

export const getUserFileStats = async (
  userId: number,
): Promise<{ count: number; size: number }> => {
  const aggregation = await File.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        size: { $sum: '$size' },
      },
    },
  ]);
  const rawStats =
    (aggregation[0] as
      | {
          count?: number;
          size?: number;
        }
      | undefined) || {};
  return {
    count: rawStats.count ?? 0,
    size: rawStats.size ?? 0,
  };
};

export const setDraftForFiles = async (
  ids: Types.ObjectId[],
  userId: number,
  draftId: Types.ObjectId,
): Promise<void> => {
  if (ids.length === 0) return;
  await File.updateMany(
    { _id: { $in: ids }, userId },
    { $set: { draftId, scope: 'draft', detached: false } },
  ).exec();
};

export const clearDraftForFile = async (id: Types.ObjectId): Promise<void> => {
  await File.updateOne({ _id: id }, { $unset: { draftId: '' } })
    .exec()
    .catch(() => undefined);
};

export const findFilesByIds = async (
  ids: Types.ObjectId[],
): Promise<Array<{ _id: Types.ObjectId; taskId?: Types.ObjectId | null }>> => {
  if (ids.length === 0) return [];
  try {
    const raw = await File.find({ _id: { $in: ids } })
      .select(['_id', 'taskId'])
      .lean()
      .exec();

    return (raw ?? []).map((d: { _id?: unknown; taskId?: unknown }) => {
      // Ensure _id and taskId are Types.ObjectId
      const _id =
        d && d._id
          ? d._id instanceof MongooseTypes.ObjectId
            ? d._id
            : new MongooseTypes.ObjectId(String(d._id))
          : new MongooseTypes.ObjectId();
      const taskId =
        d && d.taskId
          ? d.taskId instanceof MongooseTypes.ObjectId
            ? d.taskId
            : new MongooseTypes.ObjectId(String(d.taskId))
          : undefined;
      return { _id, taskId };
    });
  } catch {
    return [];
  }
};

export const findFilesForAttachments = async (
  ids: Types.ObjectId[],
): Promise<FileRecord[]> => {
  if (ids.length === 0) return [];
  return File.find({ _id: { $in: ids } }).lean<FileRecord[]>();
};

export type UpdateManyResult = {
  matchedCount?: number;
  modifiedCount?: number;
};

export const updateFilesByFilter = async (
  filter: FilterQuery<FileDocument>,
  update: Record<string, unknown>,
): Promise<UpdateManyResult> => {
  return File.updateMany(filter, update) as unknown as UpdateManyResult;
};

export const clearTaskLinksForTask = async (
  taskId: Types.ObjectId,
): Promise<UpdateManyResult> => {
  return updateFilesByFilter(
    { taskId },
    {
      $unset: { taskId: '', draftId: '' },
      $set: { detached: true, scope: 'user' },
      $pull: { relatedTaskIds: taskId },
    },
  );
};

export const listFilesByTaskId = async (
  taskId: string,
): ReturnType<typeof listFiles> => {
  const normalizedTaskId = toObjectId(taskId);
  if (!normalizedTaskId) return [];
  const query: FilterQuery<FileDocument> = {
    $or: [{ taskId: normalizedTaskId }, { relatedTaskIds: normalizedTaskId }],
  };
  const files = await File.find(query).lean<FileRecord[]>();
  if (files.length === 0) return [];
  const task = await Task.findById(normalizedTaskId)
    .select(['task_number', 'title'])
    .lean<{ task_number?: string | null; title?: string | null }>();
  return files.map((file) => ({
    id: String(file._id),
    taskId: String(normalizedTaskId),
    taskNumber: task?.task_number ?? undefined,
    taskTitle: task?.title ?? undefined,
    userId: file.userId,
    name: file.name,
    path: file.path,
    thumbnailUrl: file.thumbnailPath ? buildThumbnailUrl(file._id) : undefined,
    type: file.type,
    size: file.size,
    uploadedAt: file.uploadedAt,
    url: buildFileUrl(file._id),
    previewUrl: buildInlineFileUrl(file._id),
  }));
};

export const linkFileToTask = async (
  fileId: string,
  taskId: string,
): Promise<FileRecord | null> => {
  const normalizedTaskId = toObjectId(taskId);
  if (!normalizedTaskId) {
    return null;
  }
  const updated = await File.findByIdAndUpdate(
    fileId,
    {
      $set: {
        taskId: normalizedTaskId,
        scope: 'task',
        detached: false,
        draftId: null,
      },
      $addToSet: { relatedTaskIds: normalizedTaskId },
    },
    { new: true },
  ).lean<FileRecord | null>();
  return updated ?? null;
};

export const unlinkFileFromTask = async (
  fileId: string,
  taskId?: string,
): Promise<FileRecord | null> => {
  const current = await File.findById(fileId).lean<FileRecord | null>();
  if (!current) return null;
  const normalizedTaskId = toObjectId(taskId ?? current.taskId);
  if (!normalizedTaskId) return current;
  const remainingRelated = (current.relatedTaskIds ?? [])
    .filter(Boolean)
    .filter((id) => String(id) !== normalizedTaskId.toHexString());
  const hasRelated = remainingRelated.length > 0;
  const hasDraft = Boolean(current.draftId);
  const shouldDetach = !hasRelated && !hasDraft;
  const nextScope: FileScope = hasDraft
    ? 'draft'
    : hasRelated
    ? 'task'
    : 'user';
  const update: Record<string, unknown> = {
    $pull: { relatedTaskIds: normalizedTaskId },
    $set: { detached: shouldDetach, scope: nextScope },
  };
  if (
    current.taskId &&
    String(current.taskId) === normalizedTaskId.toHexString()
  ) {
    update.$set = {
      ...(update.$set as Record<string, unknown>),
      taskId: null,
    };
  }
  const updated = await File.findByIdAndUpdate(fileId, update, {
    new: true,
  }).lean<FileRecord | null>();
  return updated ?? null;
};

export const getLocalFilePath = (relativePath: string): string => {
  return path.resolve(uploadsDirAbs, relativePath);
};

export const getLocalFileUrlVariants = (file: {
  _id: Types.ObjectId;
}): string[] => {
  return Array.from(
    new Set([
      buildFileUrl(file._id),
      buildInlineFileUrl(file._id),
      `/api/v1/files/${file._id}`,
    ]),
  );
};

export type { Attachment };
export type {
  DeleteFileResult,
  FileSyncSnapshot,
  StoredFile,
} from './dataStorage';
export {
  collectAttachmentLinks,
  deleteFile,
  deleteFilesForTask,
  getFile,
  getFileSyncSnapshot,
  listFiles,
  removeDetachedFilesOlderThan,
};
