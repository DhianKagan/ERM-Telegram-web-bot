// Сервис работы с файлами (загрузка/получение/удаление/привязка)
// Модули: fs, path, mongoose, services/dataStorage
import path from 'node:path';
import type { FilterQuery, Types } from 'mongoose';
import { Types as MongooseTypes } from 'mongoose';

import {
  File,
  Task,
  type Attachment,
  type FileDocument,
  type FileScope,
} from '../db/model';
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
  telegramFileId?: string | null;
  scope?: FileScope;
  detached?: boolean;
};

const uploadsDirAbs = path.resolve(uploadsDir);

const toObjectId = (
  value?: string | Types.ObjectId | null,
): Types.ObjectId | null => {
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
    telegramFileId: payload.telegramFileId ?? null,
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
      $or: [
        { relatedTaskIds: { $exists: false } },
        { relatedTaskIds: { $size: 0 } },
      ],
      uploadedAt: { $lte: cutoff },
    },
    { path: 1, thumbnailPath: 1 },
  ).lean<StaleFileEntry[]>();
};

export const deleteFilesByIds = async (
  ids: Types.ObjectId[],
): Promise<void> => {
  if (!ids.length) return;
  const deletion = File.deleteMany({ _id: { $in: ids } });
  if (typeof (deletion as { exec?: unknown }).exec === 'function') {
    await (deletion as { exec: () => Promise<unknown> }).exec();
    return;
  }
  await deletion;
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

const hasNonNullValue = (value: unknown): boolean =>
  value !== undefined && value !== null;

const normalizeObjectIdHex = (value: unknown): string | null => {
  if (value instanceof MongooseTypes.ObjectId) {
    return value.toHexString();
  }
  if (typeof value === 'string' && MongooseTypes.ObjectId.isValid(value)) {
    return value.toLowerCase();
  }
  return null;
};

const computeTaskRemovalUpdate = (
  current: FileRecord,
  taskId: Types.ObjectId,
): Record<string, unknown> => {
  const taskIdHex = taskId.toHexString();
  const remainingRelated = (current.relatedTaskIds ?? [])
    .filter(Boolean)
    .map((id) => normalizeObjectIdHex(id))
    .filter((id): id is string => Boolean(id))
    .filter((id) => id !== taskIdHex);
  const hasRelated = remainingRelated.length > 0;
  const hasDraft = hasNonNullValue(current.draftId);
  const currentTaskHex = normalizeObjectIdHex(current.taskId);
  const hasTaskLink = Boolean(currentTaskHex && currentTaskHex !== taskIdHex);
  const shouldDetach = !hasRelated && !hasDraft && !hasTaskLink;
  const nextScope: FileScope = hasDraft
    ? 'draft'
    : hasRelated || hasTaskLink
      ? 'task'
      : 'user';
  const update: Record<string, unknown> = {
    $pull: { relatedTaskIds: taskId },
    $set: { detached: shouldDetach, scope: nextScope },
  };
  if (currentTaskHex === taskIdHex) {
    update.$set = {
      ...(update.$set as Record<string, unknown>),
      taskId: null,
    };
  }
  return update;
};

const computeDraftRemovalUpdate = (
  current: FileRecord,
): Record<string, unknown> => {
  const relatedIds = (current.relatedTaskIds ?? [])
    .filter(Boolean)
    .map((id) => normalizeObjectIdHex(id))
    .filter((id): id is string => Boolean(id));
  const hasRelated = relatedIds.length > 0;
  const hasTaskLink = hasNonNullValue(current.taskId);
  const shouldDetach = !hasRelated && !hasTaskLink;
  const nextScope: FileScope = hasTaskLink || hasRelated ? 'task' : 'user';
  return {
    $set: {
      draftId: null,
      detached: shouldDetach,
      scope: nextScope,
    },
  };
};

export const findFilesByIds = async (
  ids: Types.ObjectId[],
): Promise<
  Array<{
    _id: Types.ObjectId;
    taskId?: Types.ObjectId | null;
    relatedTaskIds?: Types.ObjectId[];
    draftId?: Types.ObjectId | null;
  }>
> => {
  if (ids.length === 0) return [];
  try {
    const raw = await File.find({ _id: { $in: ids } })
      .select(['_id', 'taskId', 'relatedTaskIds', 'draftId'])
      .lean()
      .exec();

    return (raw ?? []).map(
      (d: {
        _id?: unknown;
        taskId?: unknown;
        relatedTaskIds?: unknown;
        draftId?: unknown;
      }) => {
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
        const relatedTaskIds = Array.isArray(d?.relatedTaskIds)
          ? d.relatedTaskIds
              .filter((value) => value)
              .map((value) =>
                value instanceof MongooseTypes.ObjectId
                  ? value
                  : new MongooseTypes.ObjectId(String(value)),
              )
          : undefined;
        const draftId =
          d && d.draftId
            ? d.draftId instanceof MongooseTypes.ObjectId
              ? d.draftId
              : new MongooseTypes.ObjectId(String(d.draftId))
            : undefined;
        return { _id, taskId, relatedTaskIds, draftId };
      },
    );
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
  const count = await detachFilesForTask(taskId);
  return { matchedCount: count, modifiedCount: count };
};

export const detachFilesForTask = async (
  taskId: Types.ObjectId | string,
  filter?: FilterQuery<FileDocument>,
): Promise<number> => {
  const normalizedTaskId = toObjectId(taskId);
  if (!normalizedTaskId) return 0;
  const query =
    filter ??
    ({
      $or: [{ taskId: normalizedTaskId }, { relatedTaskIds: normalizedTaskId }],
    } as FilterQuery<FileDocument>);
  const files = await File.find(query).lean<FileRecord[]>();
  if (files.length === 0) return 0;
  const bulk = files.map((file) => ({
    updateOne: {
      filter: { _id: file._id },
      update: computeTaskRemovalUpdate(file, normalizedTaskId),
    },
  }));
  await File.bulkWrite(bulk);
  return files.length;
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

export const linkFilesToTask = async (
  taskId: Types.ObjectId | string,
  fileIds: Types.ObjectId[],
): Promise<void> => {
  const normalizedTaskId = toObjectId(taskId);
  if (!normalizedTaskId || fileIds.length === 0) return;
  await File.updateMany(
    { _id: { $in: fileIds } },
    {
      $addToSet: { relatedTaskIds: normalizedTaskId },
      $set: { scope: 'task', detached: false },
    },
  ).exec();
};

export const unlinkFileFromTask = async (
  fileId: string,
  taskId?: string,
): Promise<FileRecord | null> => {
  const current = await File.findById(fileId).lean<FileRecord | null>();
  if (!current) return null;
  const normalizedTaskId = toObjectId(taskId ?? current.taskId);
  if (!normalizedTaskId) return current;
  const update = computeTaskRemovalUpdate(current, normalizedTaskId);
  const updated = await File.findByIdAndUpdate(fileId, update, {
    new: true,
  }).lean<FileRecord | null>();
  return updated ?? null;
};

export const unlinkFileFromDraft = async (
  fileId: string,
): Promise<FileRecord | null> => {
  const current = await File.findById(fileId).lean<FileRecord | null>();
  if (!current) return null;
  const update = computeDraftRemovalUpdate(current);
  const updated = await File.findByIdAndUpdate(fileId, update, {
    new: true,
  }).lean<FileRecord | null>();
  return updated ?? null;
};

export const clearDraftForFile = async (id: Types.ObjectId): Promise<void> => {
  await unlinkFileFromDraft(id.toHexString()).catch(() => undefined);
};

export const detachFilesForDraft = async (
  draftId: Types.ObjectId | string,
): Promise<number> => {
  const normalizedDraftId = toObjectId(draftId);
  if (!normalizedDraftId) return 0;
  const files = await File.find({ draftId: normalizedDraftId }).lean<
    FileRecord[]
  >();
  if (files.length === 0) return 0;
  const bulk = files.map((file) => ({
    updateOne: {
      filter: { _id: file._id },
      update: computeDraftRemovalUpdate(file),
    },
  }));
  await File.bulkWrite(bulk);
  return files.length;
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
