// Финализация временных загрузок задач.
// Основные модули: node:path, node:fs/promises, mongoose, utils/requestUploads, db/model.
import path from 'node:path';
import fs from 'node:fs/promises';
import { Types } from 'mongoose';
import type { Request } from 'express';
import type RequestWithUser from '../types/request';
import { consumePendingUploads, clearPendingUploads } from '../utils/requestUploads';
import { clearUploadContext } from './uploadContext';
import { uploadsDir } from '../config/storage';
import { File, Task } from '../db/model';
import { buildFileUrl, buildThumbnailUrl } from '../utils/fileUrls';
import { writeLog } from '../services/wgLogEngine';
import { moveFile } from '../utils/moveFile';

const uploadsDirAbs = path.resolve(uploadsDir);
const TEMP_URL_PREFIX = 'temp://';

type AttachmentLike = {
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

const ensureWithin = (base: string, target: string): string => {
  const normalizedBase = path.resolve(base);
  const resolved = path.resolve(target);
  if (!resolved.startsWith(normalizedBase + path.sep)) {
    throw new Error('INVALID_PATH');
  }
  return resolved;
};

const relativeToUploads = (target: string): string | undefined => {
  const absolute = path.resolve(target);
  const relative = path.relative(uploadsDirAbs, absolute);
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    relative.length === 0
  ) {
    return undefined;
  }
  return relative.split(path.sep).join('/');
};

const cleanupMovedFiles = async (paths: string[]): Promise<void> => {
  await Promise.all(paths.map((p) => fs.unlink(p).catch(() => undefined)));
};

const cleanupDirectories = async (dirs: Iterable<string>): Promise<void> => {
  const unique = Array.from(new Set(Array.from(dirs).filter(Boolean)));
  await Promise.all(
    unique.map((dir) => fs.rm(dir, { recursive: true, force: true }).catch(() => undefined)),
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
      attachments: options.attachments ? [...options.attachments] : [],
      created: [],
      fileIds: [],
    };
  }
  const directories = new Set<string>();
  const replacements = new Map<string, AttachmentLike>();
  const createdIds: string[] = [];
  const createdAttachments: AttachmentLike[] = [];
  const movedPaths: string[] = [];
  const movedThumbnails: string[] = [];
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
      const userDir = path.resolve(uploadsDirAbs, String(entry.userId));
      await fs.mkdir(userDir, { recursive: true });
      const finalPath = ensureWithin(userDir, path.join(userDir, path.basename(entry.tempPath)));
      await moveFile(entry.tempPath, finalPath);
      movedPaths.push(finalPath);
      let thumbnailRelative: string | undefined;
      let thumbnailFinalPath: string | undefined;
      if (entry.tempThumbnailPath) {
        const thumbTarget = ensureWithin(
          userDir,
          path.join(userDir, path.basename(entry.tempThumbnailPath)),
        );
        try {
          await moveFile(entry.tempThumbnailPath, thumbTarget);
          thumbnailFinalPath = thumbTarget;
          movedThumbnails.push(thumbTarget);
          thumbnailRelative = relativeToUploads(thumbTarget);
        } catch (error) {
          const err = error as NodeJS.ErrnoException;
          if (err.code !== 'ENOENT') {
            throw error;
          }
        }
      }
      const relative = relativeToUploads(finalPath);
      if (!relative) {
        throw new Error('INVALID_PATH');
      }
      const doc = await File.create({
        userId: entry.userId,
        name: entry.originalName,
        path: relative,
        thumbnailPath: thumbnailRelative,
        type: entry.mimeType,
        size: entry.size,
        taskId: normalizedTaskId,
        draftId: normalizedDraftId,
      });
      createdIds.push(String(doc._id));
      const attachment: AttachmentLike = {
        name: entry.originalName,
        url: buildFileUrl(doc._id),
        thumbnailUrl: thumbnailRelative ? buildThumbnailUrl(doc._id) : undefined,
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
    await cleanupMovedFiles(movedPaths);
    await cleanupMovedFiles(movedThumbnails);
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
  if (normalizedTaskId) {
    await Task.updateOne(
      { _id: normalizedTaskId },
      { attachments: applied },
    ).exec();
  }
  return {
    attachments: applied,
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
