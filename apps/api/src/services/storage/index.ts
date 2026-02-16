import { createDiskStorageBackend } from './diskStorageBackend';
import { createS3StorageBackend } from './s3StorageBackend';
import type { StorageBackend } from './types';

let backendInstance: StorageBackend | null = null;

const normalizeBackendName = (value: string | undefined): 'disk' | 's3' => {
  const normalized = (value ?? 'disk').trim().toLowerCase();
  return normalized === 's3' ? 's3' : 'disk';
};

export const getStorageBackend = (): StorageBackend => {
  if (backendInstance) {
    return backendInstance;
  }
  const backend = normalizeBackendName(process.env.STORAGE_BACKEND);
  backendInstance =
    backend === 's3' ? createS3StorageBackend() : createDiskStorageBackend();
  return backendInstance;
};

export const resetStorageBackendForTests = (): void => {
  backendInstance = null;
};

export * from './types';

export { createDiskStorageBackend } from './diskStorageBackend';
