import { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { readS3Config } from '../../config/s3';
import { buildStorageKey } from './keyBuilder';
import type {
  ReadObjectResult,
  SaveObjectInput,
  SaveObjectResult,
  StorageBackend,
} from './types';

export class S3StorageBackend implements StorageBackend {
  constructor(
    private readonly bucket: string,
    private readonly client: Pick<S3Client, 'send'>,
  ) {}

  async save(input: SaveObjectInput): Promise<SaveObjectResult> {
    const key = buildStorageKey(input);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.body,
        ContentType: input.mimeType || 'application/octet-stream',
      }),
    );
    return { path: key };
  }

  async read(key: string): Promise<ReadObjectResult> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body) {
      const error = new Error('Файл не найден') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    if (response.Body instanceof Readable) {
      return { stream: response.Body };
    }
    if (
      typeof (response.Body as { transformToByteArray?: unknown })
        .transformToByteArray === 'function'
    ) {
      const bytes = await (
        response.Body as { transformToByteArray: () => Promise<Uint8Array> }
      ).transformToByteArray();
      return { stream: Readable.from(Buffer.from(bytes)) };
    }
    return {
      stream: Readable.from(response.Body as AsyncIterable<Uint8Array>),
    };
  }

  async delete(key?: string | null): Promise<void> {
    if (!key) return;
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async getSignedUrl(key: string): Promise<string> {
    return `s3://${this.bucket}/${key}`;
  }
}

export const createS3StorageBackend = (): StorageBackend => {
  const validation = readS3Config();
  if (!validation.ok || !validation.config) {
    throw new Error('S3-конфигурация неполная или некорректная');
  }
  const cfg = validation.config;
  const client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    forcePathStyle: cfg.forcePathStyle,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return new S3StorageBackend(cfg.bucket, client);
};
