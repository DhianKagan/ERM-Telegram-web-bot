// Финализация временных загрузок задач.
// Основные модули: node:path, node:fs/promises, mongoose, utils/requestUploads, db/model.
import fs from 'node:fs/promises';
import { Types } from 'mongoose';
import type { Request } from 'express';
import type RequestWithUser from '../types/request';
import {
  consumePendingUploads,
  clearPendingUploads,
} from '../utils/requestUploads';
import { clearUploadContext } from './uploadContext';
import { Task } from '../db/model';
import { extractFileIdFromUrl } from '../utils/attachments';
import { buildFileUrl, buildThumbnailUrl } from '../utils/fileUrls';
import { writeLog } from '../services/wgLogEngine';
import { createFileRecord } from '../services/fileService';
import { getStorageBackend } from '../services/storage';

const TEMP_URL_PREFIX = 'temp://';
const storageBackend = getStorageBackend();

type AttachmentLike = {
  fileId?: string;
  name?: string;
  url?: string;
  thumbnailUrl?: string;
  uploadedBy?: number;
  uploadedAt?: Date | string;
  type?: string;
  size?: number;
};

const toObjectId = (value: string | Types.ObjectId | undefined) => {
  if (!value) return undefined;
  if (value instanceof Types.ObjectId) {
    return value;
  }
  if (Types.ObjectId.isValid(value)) {
    return new Types.ObjectId(value);
  }
  return undefined;
};

const normalizeAttachmentEntry = (entry: AttachmentLike): AttachmentLike => {
  const normalized = { ...entry };
  const fileIdRaw =
    typeof normalized.fileId === 'string' ? normalized.fileId.trim() : '';
  const urlRaw =
    typeof normalized.url === 'string' ? normalized.url.trim() : '';
  if (!urlRaw && fileIdRaw) {
    normalized.url = buildFileUrl(fileIdRaw);
  }
  if (!fileIdRaw && urlRaw) {
    const extracted = extractFileIdFromUrl(urlRaw);
    if (extracted) {
      normalized.fileId = extracted;
    }
  }
  return normalized;
};

const normalizeAttachmentList = (
  list: AttachmentLike[] = [],
): AttachmentLike[] => {
  const seen = new Set<string>();
  const result: AttachmentLike[] = [];
  list.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const normalized = normalizeAttachmentEntry(entry);
    const urlKey =
      typeof normalized.url === 'string' ? normalized.url.trim() : '';
    const fileIdKey =
      typeof normalized.fileId === 'string' ? normalized.fileId.trim() : '';
    const key = urlKey ? `url:${urlKey}` : fileIdKey ? `id:${fileIdKey}` : '';
    if (key) {
      if (seen.has(key)) return;
      seen.add(key);
    }
    result.push(normalized);
  });
  return result;
};

const cleanupDirectories = async (dirs: Iterable<string>): Promise<void> => {
  const unique = Array.from(new Set(Array.from(dirs).filter(Boolean)));
  await Promise.all(
    unique.map((dir) =>
      fs.rm(dir, { recursive: true, force: true }).catch(() => undefined),
    ),
  );
};

export const isTemporaryUrl = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(TEMP_URL_PREFIX);

type FinalizeOptions = {
  req: Request & RequestWithUser;
  taskId?: string | Types.ObjectId;
  draftId?: string | Types.ObjectId;
  attachments?: AttachmentLike[];
};

type FinalizeResult = {
  attachments: AttachmentLike[];
  created: AttachmentLike[];
  fileIds: string[];
};

export const finalizePendingUploads = async (
  options: FinalizeOptions,
): Promise<FinalizeResult> => {
  const { req } = options;
  const pending = consumePendingUploads(req);
  if (pending.length === 0) {
    return {
      attachments: normalizeAttachmentList(options.attachments ?? []),
      created: [],
      fileIds: [],
    };
  }
  const directories = new Set<string>();
  const replacements = new Map<string, AttachmentLike>();
  const createdIds: string[] = [];
  const createdAttachments: AttachmentLike[] = [];
  const storedPaths: string[] = [];
  const normalizedTaskId = toObjectId(options.taskId);
  const normalizedDraftId = toObjectId(options.draftId);
  let normalizedAttachments: AttachmentLike[] = [];
  if (Array.isArray(options.attachments)) {
    normalizedAttachments = options.attachments.map((item) => ({ ...item }));
  } else if (normalizedTaskId) {
    const current = await Task.findById(normalizedTaskId)
      .select(['attachments'])
      .lean<{ attachments?: AttachmentLike[] }>();
    if (current?.attachments && Array.isArray(current.attachments)) {
      normalizedAttachments = current.attachments.map((item) => ({ ...item }));
    }
  }
  try {
    for (const entry of pending) {
      directories.add(entry.tempDir);
      const fileId = new Types.ObjectId();
      const fileBuffer = await fs.readFile(entry.tempPath);
      const stored = await storageBackend.save({
        fileId: fileId.toHexString(),
        userId: entry.userId,
        fileName: entry.originalName,
        body: fileBuffer,
        mimeType: entry.mimeType,
        taskId: normalizedTaskId?.toHexString(),
      });
      storedPaths.push(stored.path);
      await fs.unlink(entry.tempPath).catch(() => undefined);
      let thumbnailPath: string | undefined;
      if (entry.tempThumbnailPath) {
        try {
          const thumbBuffer = await fs.readFile(entry.tempThumbnailPath);
          const storedThumb = await storageBackend.save({
            fileId: fileId.toHexString(),
            userId: entry.userId,
            fileName: `thumb-${entry.originalName}`,
            body: thumbBuffer,
            mimeType: 'image/jpeg',
            taskId: normalizedTaskId?.toHexString(),
            variant: 'thumbnail',
          });
          thumbnailPath = storedThumb.path;
          storedPaths.push(storedThumb.path);
          await fs.unlink(entry.tempThumbnailPath).catch(() => undefined);
        } catch (error) {
          const err = error as NodeJS.ErrnoException;
          if (err.code !== 'ENOENT') {
            throw error;
          }
        }
      }
      const doc = await createFileRecord({
        id: fileId,
        userId: entry.userId,
        name: entry.originalName,
        path: stored.path,
        thumbnailPath,
        type: entry.mimeType,
        size: entry.size,
        taskId: normalizedTaskId ?? undefined,
        draftId: normalizedDraftId ?? undefined,
      });
      createdIds.push(String(doc._id));
      const attachment: AttachmentLike = {
        fileId: String(doc._id),
        name: entry.originalName,
        url: buildFileUrl(doc._id),
        thumbnailUrl: thumbnailPath ? buildThumbnailUrl(doc._id) : undefined,
        uploadedBy: entry.userId,
        uploadedAt: new Date(),
        type: entry.mimeType,
        size: entry.size,
      };
      createdAttachments.push(attachment);
      replacements.set(entry.placeholder, attachment);
      await writeLog('Загружен файл', 'info', {
        userId: entry.userId,
        name: entry.originalName,
      });
    }
  } catch (error) {
    await Promise.all(
      storedPaths.map((storedPath) =>
        storageBackend.delete(storedPath).catch(() => undefined),
      ),
    );
    await cleanupDirectories(directories);
    clearPendingUploads(req);
    clearUploadContext(req);
    throw error;
  }
  await cleanupDirectories(directories);
  clearUploadContext(req);
  const applied = normalizedAttachments.map((item) => {
    if (typeof item.url === 'string' && replacements.has(item.url)) {
      const replacement = replacements.get(item.url)!;
      return { ...item, ...replacement };
    }
    return item;
  });
  replacements.forEach((attachment, key) => {
    const exists = applied.some(
      (item) => typeof item.url === 'string' && item.url === attachment.url,
    );
    if (!exists) {
      applied.push({ ...attachment });
    }
    replacements.delete(key);
  });
  const normalizedApplied = normalizeAttachmentList(applied);
  if (normalizedTaskId) {
    await Task.updateOne(
      { _id: normalizedTaskId },
      { attachments: normalizedApplied },
    ).exec();
  }
  return {
    attachments: normalizedApplied,
    created: createdAttachments,
    fileIds: createdIds,
  };
};

export const purgeTemporaryUploads = async (req: Request): Promise<void> => {
  const pending = consumePendingUploads(req);
  if (pending.length === 0) {
    clearUploadContext(req as RequestWithUser);
    return;
  }
  const directories = new Set<string>();
  await Promise.all(
    pending.map(async (entry) => {
      directories.add(entry.tempDir);
      await fs.unlink(entry.tempPath).catch(() => undefined);
      if (entry.tempThumbnailPath) {
        await fs.unlink(entry.tempThumbnailPath).catch(() => undefined);
      }
    }),
  );
  await cleanupDirectories(directories);
  clearUploadContext(req as RequestWithUser);
};

export type { AttachmentLike };
export { TEMP_URL_PREFIX };
