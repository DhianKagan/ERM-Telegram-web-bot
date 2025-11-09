// Утилиты для отслеживания временных загрузок в запросе
// Основные модули: express, services/dataStorage, wgLogEngine
import type { Request } from 'express';
import fs from 'node:fs/promises';
import { deleteFile } from '../services/dataStorage';
import { writeLog } from '../services/wgLogEngine';

const UPLOADED_FILE_IDS_FIELD = Symbol('uploadedFileIds');

type RequestWithUploads = Request & {
  [UPLOADED_FILE_IDS_FIELD]?: string[];
};

type RequestWithPending = Request & {
  [PENDING_UPLOADS_FIELD]?: PendingUploadEntry[];
};

export type PendingUploadEntry = {
  placeholder: string;
  tempPath: string;
  tempThumbnailPath?: string;
  tempDir: string;
  originalName: string;
  mimeType: string;
  size: number;
  userId: number;
};

const PENDING_UPLOADS_FIELD = Symbol('pendingUploads');

const getMutableList = (req: RequestWithUploads): string[] => {
  if (!req[UPLOADED_FILE_IDS_FIELD]) {
    req[UPLOADED_FILE_IDS_FIELD] = [];
  }
  return req[UPLOADED_FILE_IDS_FIELD]!;
};

export const registerUploadedFile = (req: Request, fileId: string): void => {
  if (!fileId) return;
  const target = req as RequestWithUploads;
  const list = getMutableList(target);
  if (!list.includes(fileId)) {
    list.push(fileId);
  }
};

export const getUploadedFileIds = (req: Request): string[] => {
  const target = req as RequestWithUploads;
  const list = target[UPLOADED_FILE_IDS_FIELD];
  return Array.isArray(list) ? [...list] : [];
};

const getPendingMutableList = (req: RequestWithPending): PendingUploadEntry[] => {
  if (!req[PENDING_UPLOADS_FIELD]) {
    req[PENDING_UPLOADS_FIELD] = [];
  }
  return req[PENDING_UPLOADS_FIELD]!;
};

export const appendPendingUpload = (
  req: Request,
  entry: PendingUploadEntry,
): void => {
  if (!entry.placeholder || !entry.tempPath) {
    return;
  }
  const target = req as RequestWithPending;
  const list = getPendingMutableList(target);
  list.push({ ...entry });
};

export const consumePendingUploads = (req: Request): PendingUploadEntry[] => {
  const target = req as RequestWithPending;
  const list = target[PENDING_UPLOADS_FIELD];
  target[PENDING_UPLOADS_FIELD] = [];
  return Array.isArray(list) ? list.map((item) => ({ ...item })) : [];
};

export const peekPendingUploads = (req: Request): PendingUploadEntry[] => {
  const target = req as RequestWithPending;
  const list = target[PENDING_UPLOADS_FIELD];
  return Array.isArray(list) ? list.map((item) => ({ ...item })) : [];
};

export const clearPendingUploads = (req: Request): void => {
  const target = req as RequestWithPending;
  target[PENDING_UPLOADS_FIELD] = [];
};

const cleanupPendingEntries = async (
  entries: PendingUploadEntry[],
): Promise<void> => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return;
  }
  const uniqueDirs = new Set<string>();
  await Promise.all(
    entries.map(async (entry) => {
      if (entry.tempPath) {
        await fs.unlink(entry.tempPath).catch(() => undefined);
      }
      if (entry.tempThumbnailPath) {
        await fs.unlink(entry.tempThumbnailPath).catch(() => undefined);
      }
      if (entry.tempDir) {
        uniqueDirs.add(entry.tempDir);
      }
    }),
  );
  await Promise.all(
    Array.from(uniqueDirs).map(async (dir) => {
      if (!dir) return;
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch {
        /* игнорируем сбой удаления каталога */
      }
    }),
  );
};

export const discardPendingUploads = async (req: Request): Promise<void> => {
  const entries = consumePendingUploads(req);
  await cleanupPendingEntries(entries);
};

export const cleanupUploadedFiles = async (req: Request): Promise<void> => {
  await discardPendingUploads(req);
  const target = req as RequestWithUploads;
  const list = target[UPLOADED_FILE_IDS_FIELD];
  if (!Array.isArray(list) || list.length === 0) {
    return;
  }
  target[UPLOADED_FILE_IDS_FIELD] = [];
  const uniqueIds = Array.from(new Set(list.filter(Boolean)));
  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        await deleteFile(id);
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
          return;
        }
        await writeLog('Не удалось удалить временный файл запроса', 'error', {
          fileId: id,
          error: err?.message || String(error),
        }).catch(() => undefined);
      }
    }),
  );
};

export const clearUploadedFiles = (req: Request): void => {
  const target = req as RequestWithUploads;
  target[UPLOADED_FILE_IDS_FIELD] = [];
};
