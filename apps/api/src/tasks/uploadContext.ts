// Управление временным контекстом загрузок задач.
// Основные модули: node:os, node:path, node:crypto, types/request.
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type RequestWithUser from '../types/request';

export type UploadContext = {
  id: string;
  dir: string;
  userId: number;
};

const tempUploadsRoot = path.join(os.tmpdir(), 'erm-api-uploads');
const UPLOAD_CONTEXT_FIELD = Symbol('uploadContext');

type RequestWithUploadContext = RequestWithUser & {
  [UPLOAD_CONTEXT_FIELD]?: UploadContext;
};

export const getTempUploadsRoot = (): string => tempUploadsRoot;

export const ensureUploadContext = (
  req: RequestWithUser,
  userId: number,
): UploadContext => {
  const target = req as RequestWithUploadContext;
  if (target[UPLOAD_CONTEXT_FIELD]) {
    return target[UPLOAD_CONTEXT_FIELD]!;
  }
  const uploadId = randomBytes(12).toString('hex');
  const dir = path.join(tempUploadsRoot, String(userId), uploadId);
  target[UPLOAD_CONTEXT_FIELD] = { id: uploadId, dir, userId };
  return target[UPLOAD_CONTEXT_FIELD]!;
};

export const getUploadContext = (
  req: RequestWithUser,
): UploadContext | undefined => {
  const target = req as RequestWithUploadContext;
  return target[UPLOAD_CONTEXT_FIELD];
};

export const clearUploadContext = (req: RequestWithUser): void => {
  const target = req as RequestWithUploadContext;
  if (target[UPLOAD_CONTEXT_FIELD]) {
    delete target[UPLOAD_CONTEXT_FIELD];
  }
};
