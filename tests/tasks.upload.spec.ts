/**
 * Назначение файла: проверка chunk-upload, скачивания и удаления вложений задач.
 * Основные модули: express, supertest, multer, dataStorage сервис.
 */
import express = require('express');
import type { RequestHandler } from 'express';
import request = require('supertest');
import rateLimit from 'express-rate-limit';
// @ts-ignore
import multer from '../apps/api/node_modules/multer';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const { Types } = require('../apps/api/node_modules/mongoose');

const storedFiles: Array<{
  _id: unknown;
  userId: number;
  name: string;
  path: string;
  thumbnailPath?: string;
  type: string;
  size: number;
  uploadedAt: Date;
}> = [];

const currentUserId = 7;

jest.mock('../apps/api/src/services/antivirus', () => ({
  scanFile: jest.fn().mockResolvedValue(true),
}));

jest.mock('../apps/api/src/services/wgLogEngine', () => ({
  writeLog: jest.fn(),
}));

jest.mock('../apps/api/src/middleware/auth', () =>
  function authMock(): RequestHandler {
    return (req, _res, next) => {
      (req as any).user = { id: currentUserId, access: 2 };
      next();
    };
  },
);

jest.mock('../apps/api/src/db/model', () => {
  const File = {
    aggregate: jest.fn(async (pipeline: any[]) => {
      let files = [...storedFiles];
      const matchStage = pipeline.find((stage) => stage.$match);
      if (matchStage?.$match?.userId !== undefined) {
        files = files.filter((f) => f.userId === matchStage.$match.userId);
      }
      if (!files.length) return [];
      const size = files.reduce((total, f) => total + f.size, 0);
      return [{ _id: null, count: files.length, size }];
    }),
    create: jest.fn(async (data: any) => {
      const doc = {
        ...data,
        _id: new Types.ObjectId(),
        uploadedAt: new Date(),
      };
      storedFiles.push(doc);
      return doc;
    }),
    findById: jest.fn((id: unknown) => ({
      lean: async () =>
        storedFiles.find((f) => String(f._id) === String(id)) || null,
    })),
    findOneAndDelete: jest.fn((query: any) => ({
      lean: async () => {
        const idx = storedFiles.findIndex((f) => f.path === query.path);
        if (idx === -1) return null;
        const [doc] = storedFiles.splice(idx, 1);
        return doc;
      },
    })),
    find: jest.fn((query: any = {}) => ({
      lean: async () => {
        let files = [...storedFiles];
        if (query.userId !== undefined) {
          files = files.filter((f) => f.userId === query.userId);
        }
        if (query.type?.$eq !== undefined) {
          files = files.filter((f) => f.type === query.type.$eq);
        }
        return files;
      },
    })),
  };
  const Task = {
    findById: jest.fn(() => ({ lean: async () => null })),
    updateOne: jest.fn(() => ({ exec: async () => undefined })),
  };
  return { File, Task, __store: storedFiles };
});

let handleChunks: typeof import('../apps/api/src/routes/tasks').handleChunks;
let uploadsDir: string;
let deleteFile: typeof import('../apps/api/src/services/dataStorage').deleteFile;
let filesRouter: express.Router;
let tempRoot: string;
let app: express.Express;

async function uploadViaChunks(
  fileId: string,
  chunks: Buffer[],
  filename: string,
  mimetype: string,
): Promise<{
  attachment: {
    name: string;
    url: string;
    thumbnailUrl?: string;
  };
  storedPath: string;
  content: Buffer;
}> {
  for (let index = 0; index < chunks.length - 1; index++) {
    const interim = await request(app)
      .post('/upload-chunk')
      .field('fileId', fileId)
      .field('chunkIndex', String(index))
      .field('totalChunks', String(chunks.length))
      .attach('file', chunks[index], {
        filename,
        contentType: mimetype,
      });
    expect(interim.status).toBe(200);
    expect(interim.body.received).toBe(index);
  }
  const lastIndex = chunks.length - 1;
  const finalResponse = await request(app)
    .post('/upload-chunk')
    .field('fileId', fileId)
    .field('chunkIndex', String(lastIndex))
    .field('totalChunks', String(chunks.length))
    .attach('file', chunks[lastIndex], {
      filename,
      contentType: mimetype,
    });
  expect(finalResponse.status).toBe(200);
  const attachment = finalResponse.body as {
    name: string;
    url: string;
    thumbnailUrl?: string;
  };
  const stored = storedFiles[storedFiles.length - 1];
  return {
    attachment,
    storedPath: stored.path,
    content: Buffer.concat(chunks),
  };
}

beforeAll(async () => {
  jest.resetModules();
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'erm-upload-'));
  process.env.STORAGE_DIR = tempRoot;
  const tasksModule = await import('../apps/api/src/routes/tasks');
  handleChunks = tasksModule.handleChunks;
  ({ uploadsDir } = await import('../apps/api/src/config/storage'));
  ({ deleteFile } = await import('../apps/api/src/services/dataStorage'));
  ({ default: filesRouter } = await import('../apps/api/src/routes/files'));
  app = express();
  const limiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
  const setUser: RequestHandler = (req, _res, next) => {
    (req as any).user = { id: currentUserId };
    next();
  };
  const chunkUpload = multer({ storage: multer.memoryStorage() });
  app.post(
    '/upload-chunk',
    setUser,
    limiter,
    chunkUpload.single('file') as unknown as RequestHandler,
    handleChunks as unknown as RequestHandler,
  );
  app.use('/api/v1/files', filesRouter);
});

beforeEach(() => {
  storedFiles.length = 0;
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } else {
    for (const entry of fs.readdirSync(uploadsDir)) {
      fs.rmSync(path.join(uploadsDir, entry), { recursive: true, force: true });
    }
  }
});

afterAll(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('Chunk upload', () => {
  test('загружает файл чанками в каталог пользователя', async () => {
    const chunks = [Buffer.from('Hello '), Buffer.from('world!')];
    const { attachment, storedPath, content } = await uploadViaChunks(
      'chunk-demo',
      chunks,
      'report.txt',
      'text/plain',
    );
    expect(attachment.name).toBe('report.txt');
    expect(attachment.url).toMatch(/\/api\/v1\/files\//);
    const absolute = path.resolve(uploadsDir, storedPath);
    expect(fs.existsSync(absolute)).toBe(true);
    expect(fs.readFileSync(absolute).toString()).toBe(content.toString());
    expect(storedPath.startsWith(`${currentUserId}/`)).toBe(true);
  });

  test('позволяет скачать собранный файл', async () => {
    const chunks = [Buffer.from('first '), Buffer.from('second')];
    const { attachment, content } = await uploadViaChunks(
      'chunk-download',
      chunks,
      'notes.txt',
      'text/plain',
    );
    const response = await request(app).get(attachment.url);
    expect(response.status).toBe(200);
    expect(response.text).toBe(content.toString());
  });

  test('удаляет файл и запись через deleteFile', async () => {
    const chunks = [Buffer.from('A '), Buffer.from('B')];
    const { attachment, storedPath } = await uploadViaChunks(
      'chunk-delete',
      chunks,
      'todo.txt',
      'text/plain',
    );
    const absolute = path.resolve(uploadsDir, storedPath);
    await deleteFile(storedPath);
    expect(fs.existsSync(absolute)).toBe(false);
    expect(storedFiles).toHaveLength(0);
    const res = await request(app).get(attachment.url);
    expect(res.status).toBe(404);
  });
});
