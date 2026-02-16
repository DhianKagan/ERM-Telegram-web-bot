import path from 'node:path';
import { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { Types } from 'mongoose';
import {
  getStorageBackend,
  resetStorageBackendForTests,
} from '../src/services/storage';
import { S3StorageBackend } from '../src/services/storage/s3StorageBackend';
import { createFileRecord } from '../src/services/fileService';

process.env.NODE_ENV = 'test';

jest.mock('../src/services/fileService', () => ({
  createFileRecord: jest.fn(),
}));

describe('storage backend', () => {
  afterEach(() => {
    resetStorageBackendForTests();
    jest.clearAllMocks();
  });

  test('s3: upload -> read -> delete', async () => {
    const body = Buffer.from('hello-s3');
    const deleted: string[] = [];
    const sent: unknown[] = [];
    const s3 = {
      send: jest.fn(async (command: unknown) => {
        sent.push(command);
        if (command instanceof PutObjectCommand) return {};
        if (command instanceof DeleteObjectCommand) {
          deleted.push('ok');
          return {};
        }
        if (command instanceof GetObjectCommand) {
          return { Body: Readable.from(body) };
        }
        throw new Error('unexpected command');
      }),
    };
    const signUrl = jest.fn(
      async ({ key }: { key: string }) =>
        `https://cdn.example.test/${encodeURIComponent(key)}?sig=test`,
    );
    const backend = new S3StorageBackend('bucket', s3, signUrl);

    const saved = await backend.save({
      fileId: '64d000000000000000000001',
      userId: 7,
      fileName: 'Документ.pdf',
      body,
      mimeType: 'application/pdf',
      taskId: '64d000000000000000000002',
    });
    const read = await backend.read(saved.path);
    const chunks: Buffer[] = [];
    for await (const chunk of read.stream) {
      chunks.push(Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString()).toBe('hello-s3');
    await backend.delete(saved.path);
    const signedUrl = await backend.getSignedUrl(saved.path);

    expect(signedUrl).toBe(
      `https://cdn.example.test/${encodeURIComponent(saved.path)}?sig=test`,
    );
    expect(signUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'bucket',
        key: saved.path,
      }),
    );
    expect(sent.some((c) => c instanceof PutObjectCommand)).toBe(true);
    expect(sent.some((c) => c instanceof GetObjectCommand)).toBe(true);
    expect(deleted.length).toBe(1);
    expect(saved.path).toContain('tasks/64d000000000000000000002/');
  });

  test('fallback на disk при неизвестном STORAGE_BACKEND', async () => {
    process.env.STORAGE_BACKEND = 'unknown';
    process.env.STORAGE_DIR = path.resolve(
      __dirname,
      '../uploads-test-backend',
    );
    const backend = getStorageBackend();
    const saved = await backend.save({
      fileId: '64d000000000000000000003',
      userId: 10,
      fileName: 'test.txt',
      body: Buffer.from('disk-data'),
      mimeType: 'text/plain',
    });
    const streamResult = await backend.read(saved.path);
    const parts: Buffer[] = [];
    for await (const part of streamResult.stream) {
      parts.push(Buffer.from(part));
    }
    expect(Buffer.concat(parts).toString()).toBe('disk-data');
    await backend.delete(saved.path);
  });

  test('s3 недоступен: ошибка и нет полузаписи в БД', async () => {
    const s3 = {
      send: jest.fn(async (command: unknown) => {
        if (command instanceof PutObjectCommand) {
          throw new Error('S3 unavailable');
        }
        return {};
      }),
    };
    const backend = new S3StorageBackend('bucket', s3);
    const id = new Types.ObjectId();

    const uploadAndCreate = async () => {
      const saved = await backend.save({
        fileId: id.toHexString(),
        userId: 11,
        fileName: 'broken.txt',
        body: Buffer.from('x'),
        mimeType: 'text/plain',
      });
      await createFileRecord({
        id,
        userId: 11,
        name: 'broken.txt',
        path: saved.path,
        type: 'text/plain',
        size: 1,
      });
    };

    await expect(uploadAndCreate()).rejects.toThrow('S3 unavailable');
    expect(createFileRecord).not.toHaveBeenCalled();
  });
});
