import fs from 'node:fs';
import path from 'node:path';
import { uploadsDir } from '../../config/storage';
import { buildStorageKey } from './keyBuilder';
import type {
  ReadObjectResult,
  SaveObjectInput,
  SaveObjectResult,
  StorageBackend,
} from './types';

const uploadsDirAbs = path.resolve(uploadsDir);

const resolveWithinUploads = (relative: string): string => {
  const targetPath = path.resolve(uploadsDirAbs, relative);
  if (!targetPath.startsWith(uploadsDirAbs + path.sep)) {
    throw new Error('Недопустимое имя файла');
  }
  return targetPath;
};

export class DiskStorageBackend implements StorageBackend {
  async save(input: SaveObjectInput): Promise<SaveObjectResult> {
    const relativePath = buildStorageKey(input);
    const absolutePath = resolveWithinUploads(relativePath);
    await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.promises.writeFile(absolutePath, input.body);
    return { path: relativePath };
  }

  async read(relativePath: string): Promise<ReadObjectResult> {
    const absolutePath = resolveWithinUploads(relativePath);
    await fs.promises.access(absolutePath, fs.constants.R_OK);
    return { stream: fs.createReadStream(absolutePath) };
  }

  async delete(relativePath?: string | null): Promise<void> {
    if (!relativePath) return;
    const absolutePath = resolveWithinUploads(relativePath);
    await fs.promises
      .unlink(absolutePath)
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      });
  }

  async getSignedUrl(relativePath: string): Promise<string> {
    const normalized = relativePath.split(path.sep).join('/');
    return `/uploads/${normalized}`;
  }
}

export const createDiskStorageBackend = (): StorageBackend =>
  new DiskStorageBackend();
