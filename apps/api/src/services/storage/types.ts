import type { Readable } from 'node:stream';

export type StorageObjectVariant = 'original' | 'thumbnail';

export type SaveObjectInput = {
  fileId: string;
  userId: number;
  fileName: string;
  body: Buffer;
  mimeType: string;
  taskId?: string;
  variant?: StorageObjectVariant;
};

export type SaveObjectResult = {
  path: string;
};

export type ReadObjectResult = {
  stream: Readable;
};

export interface StorageBackend {
  save(input: SaveObjectInput): Promise<SaveObjectResult>;
  read(path: string): Promise<ReadObjectResult>;
  delete(path?: string | null): Promise<void>;
  getSignedUrl(path: string): Promise<string>;
}
