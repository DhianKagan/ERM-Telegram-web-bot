import { normalizeFilename } from '../../utils/filename';
import type { StorageObjectVariant } from './types';

const sanitizeSegment = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'file';

export const buildStorageKey = (input: {
  taskId?: string;
  userId: number;
  fileId: string;
  fileName: string;
  variant?: StorageObjectVariant;
}): string => {
  const safeName = sanitizeSegment(normalizeFilename(input.fileName));
  const suffix = input.variant === 'thumbnail' ? '-thumb' : '';
  if (input.taskId) {
    return `tasks/${input.taskId}/${input.fileId}${suffix}-${safeName}`;
  }
  return `${input.userId}/${input.fileId}${suffix}-${safeName}`;
};
