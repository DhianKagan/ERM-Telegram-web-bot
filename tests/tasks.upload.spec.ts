/**
 * Назначение файла: проверка chunk-upload, скачивания и удаления вложений задач.
 * Основные модули: express, supertest, multer, dataStorage сервис.
 */
import express = require('express');
import type { Express, Request, RequestHandler } from 'express';
import request = require('supertest');
import rateLimit from 'express-rate-limit';
// @ts-ignore
import multer from '../apps/api/node_modules/multer';
import type { FileFilterCallback } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

process.env.MONGO_DATABASE_URL ||=
  'mongodb://admin:admin@localhost:27017/ermdb?authSource=admin';
process.env.APP_URL ||= 'https://example.com';
process.env.USER_FILES_STALE_GRACE_MINUTES ||= '5';

jest.mock('../apps/api/src/di', () => ({
  __esModule: true,
  default: {
    resolve: () => ({
      list: jest.fn((_req: unknown, _res: unknown, next?: () => void) => next?.()),
      executors: jest.fn((_req: unknown, _res: unknown, next?: () => void) => next?.()),
      mentioned: jest.fn((_req: unknown, _res: unknown, next?: () => void) => next?.()),
      transportOptions: jest.fn(
        (_req: unknown, _res: unknown, next?: () => void) => next?.(),
      ),
      summary: jest.fn((_req: unknown, _res: unknown, next?: () => void) => next?.()),
      detail: jest.fn((_req: unknown, _res: unknown, next?: () => void) => next?.()),
      createRequest: [
        jest.fn((_req: unknown, _res: unknown, next?: () => void) => next?.()),
      ],
      create: [
        jest.fn((_req: unknown, _res: unknown, next?: () => void) => next?.()),
      ],
      update: [
        jest.fn((_req: unknown, _res: unknown, next?: () => void) => next?.()),
      ],
      addTime: [
        jest.fn((_req: unknown, _res: unknown, next?: () => void) => next?.()),
      ],
      remove: jest.fn((_req: unknown, _res: unknown, next?: () => void) => next?.()),
      bulk: [
        jest.fn((_req: unknown, _res: unknown, next?: () => void) => next?.()),
      ],
    }),
  },
}));

jest.mock('../apps/api/src/tasks/tasks.controller', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../apps/api/src/config', () => ({
  __esModule: true,
  botToken: 'test-bot-token',
  botApiUrl: undefined,
  getChatId: () => '0',
  chatId: '0',
  jwtSecret: 'test-secret',
  mongoUrl: 'mongodb://admin:admin@localhost:27017/ermdb?authSource=admin',
  appUrl: 'https://example.com',
  routingUrl: 'https://localhost:8000/route',
}));

const { Types } = require('../apps/api/node_modules/mongoose');
const { checkFile } = require('../apps/api/src/utils/fileCheck');
const { ACCESS_MANAGER } = require('../apps/api/src/utils/accessMask');

const sharpToFileMock = jest.fn().mockResolvedValue(undefined);
const sharpResizeMock = jest.fn().mockReturnValue({ toFile: sharpToFileMock });
const sharpMock = jest.fn().mockReturnValue({ resize: sharpResizeMock });

jest.mock('sharp', () => ({
  __esModule: true,
  default: sharpMock,
}));

const storedFiles: Array<{
  _id: unknown;
  userId: number;
  name: string;
  path: string;
  thumbnailPath?: string;
  type: string;
  size: number;
  uploadedAt: Date;
  taskId?: InstanceType<typeof Types.ObjectId> | null;
  draftId?: InstanceType<typeof Types.ObjectId> | null;
}> = [];

const currentUserId = 7;

jest.mock('../apps/api/src/services/antivirus', () => ({
  scanFile: jest.fn().mockResolvedValue(true),
}));

let scanFile: jest.MockedFunction<(target: string) => Promise<boolean>>;

jest.mock('../apps/api/src/services/wgLogEngine', () => ({
  writeLog: jest.fn(),
}));

jest.mock('../apps/api/src/middleware/auth', () =>
  function authMock(): RequestHandler {
    return (req, _res, next) => {
      (req as any).user = { id: currentUserId, access: ACCESS_MANAGER };
      next();
    };
  },
);

jest.mock('../apps/api/src/db/model', () => {
  const tasks: Array<Record<string, any>> = [];
  const wrapSingle = (doc: any) => {
    const chain: Record<string, unknown> = {};
    chain.select = jest.fn(() => chain);
    chain.lean = jest.fn(async () => doc);
    return chain;
  };
  const wrapMulti = (docs: any[]) => {
    const chain: Record<string, unknown> = {};
    chain.select = jest.fn(() => chain);
    chain.lean = jest.fn(async () => docs);
    return chain;
  };
  const extractValues = (source: any, path: string[]): unknown[] => {
    if (path.length === 0) {
      return [source];
    }
    if (Array.isArray(source)) {
      return source.flatMap((item) => extractValues(item, path));
    }
    if (source === null || source === undefined) {
      return [];
    }
    const [head, ...rest] = path;
    return extractValues((source as Record<string, unknown>)[head], rest);
  };
  const matchesCriteria = (entity: Record<string, unknown>, criteria: any): boolean => {
    if (!criteria || typeof criteria !== 'object') {
      return true;
    }
    return Object.entries(criteria).every(([key, value]) => {
      if (key === '$or' && Array.isArray(value)) {
        return value.some((option) => matchesCriteria(entity, option));
      }
      if (key === '$and' && Array.isArray(value)) {
        return value.every((option) => matchesCriteria(entity, option));
      }
      const values = extractValues(entity, key.split('.'));
      if (value && typeof value === 'object' && !(value instanceof RegExp)) {
        const candidate = value as {
          $in?: unknown[];
          $nin?: unknown[];
          $eq?: unknown;
          $regex?: RegExp;
        };
        if (Array.isArray(candidate.$in)) {
          return values.some((current) =>
            candidate.$in!.some((entry) => String(current) === String(entry)),
          );
        }
        if (Array.isArray(candidate.$nin)) {
          return values.every(
            (current) =>
              !candidate.$nin!.some((entry) => String(current) === String(entry)),
          );
        }
        if (candidate.$regex instanceof RegExp) {
          return values.some(
            (current) => typeof current === 'string' && candidate.$regex!.test(current),
          );
        }
        if (Object.prototype.hasOwnProperty.call(candidate, '$eq')) {
          return values.some(
            (current) => String(current) === String(candidate.$eq),
          );
        }
      }
      if (value instanceof RegExp) {
        return values.some(
          (current) => typeof current === 'string' && value.test(current),
        );
      }
      if (!values.length) {
        return value === undefined;
      }
      return values.some((current) => String(current) === String(value));
    });
  };
  const File = {
    aggregate: jest.fn(async (pipeline: any[]) => {
      let files = [...storedFiles];
      const matchStage = pipeline.find((stage) => stage.$match);
      if (matchStage?.$match?.userId !== undefined) {
        files = files.filter((f) => f.userId === matchStage.$match.userId);
      }
      if (!files.length) return [];
      const totalSize = files.reduce((total, f) => total + f.size, 0);
      const graceRaw = Number(process.env.USER_FILES_STALE_GRACE_MINUTES ?? '0');
      let staleCount = 0;
      let staleSize = 0;
      if (Number.isFinite(graceRaw) && graceRaw > 0) {
        const cutoffTime = Date.now() - graceRaw * 60 * 1000;
        files.forEach((file) => {
          if (
            (file.taskId === null || file.taskId === undefined) &&
            (file.draftId === null || file.draftId === undefined) &&
            file.uploadedAt.getTime() <= cutoffTime
          ) {
            staleCount += 1;
            staleSize += file.size;
          }
        });
      }
      return [
        {
          _id: null,
          count: files.length,
          size: totalSize,
          staleCount,
          staleSize,
        },
      ];
    }),
    create: jest.fn(async (data: any) => {
      const doc = {
        ...data,
        _id: new Types.ObjectId(),
        uploadedAt: new Date(),
        taskId: null,
        draftId: data?.draftId ?? null,
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
        let idx = -1;
        if (query && typeof query === 'object') {
          if (Object.prototype.hasOwnProperty.call(query, '_id')) {
            idx = storedFiles.findIndex(
              (f) => String(f._id) === String(query._id),
            );
          } else if (Object.prototype.hasOwnProperty.call(query, 'path')) {
            idx = storedFiles.findIndex((f) => f.path === query.path);
          }
        }
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
    updateMany: jest.fn(async (filter: any = {}, update: any = {}) => {
      const match = (file: any, criteria: any): boolean => {
        if (!criteria || typeof criteria !== 'object') {
          return true;
        }
        return Object.entries(criteria).every(([key, value]) => {
          if (key === '$or' && Array.isArray(value)) {
            return value.some((option) => match(file, option));
          }
          if (key === '_id' && value && typeof value === 'object') {
            const candidate = value as { $in?: unknown[]; $nin?: unknown[] };
            if (Array.isArray(candidate.$in)) {
              return candidate.$in.some(
                (id) => String(file._id) === String(id),
              );
            }
            if (Array.isArray(candidate.$nin)) {
              return !candidate.$nin.some(
                (id) => String(file._id) === String(id),
              );
            }
          }
          if (key === 'taskId' && value && typeof value === 'object') {
            const candidate = value as { $in?: unknown[]; $nin?: unknown[] };
            if (Array.isArray(candidate.$nin)) {
              return !candidate.$nin.some(
                (id) => String(file.taskId) === String(id),
              );
            }
            if (Array.isArray(candidate.$in)) {
              return candidate.$in.some(
                (id) => String(file.taskId) === String(id),
              );
            }
          }
          if (key === 'taskId') {
            return String(file.taskId) === String(value);
          }
          const current = (file as Record<string, unknown>)[key];
          if (value && typeof value === 'object') {
            const candidate = value as { $in?: unknown[]; $nin?: unknown[] };
            if (Array.isArray(candidate.$in)) {
              return candidate.$in.some(
                (entry) => String(current) === String(entry),
              );
            }
            if (Array.isArray(candidate.$nin)) {
              return !candidate.$nin.some(
                (entry) => String(current) === String(entry),
              );
            }
          }
          return value === undefined || String(current) === String(value);
        });
      };

      let modified = 0;
      storedFiles.forEach((file) => {
        if (!match(file, filter)) return;
        modified += 1;
        if (update?.$set && typeof update.$set === 'object') {
          Object.entries(update.$set).forEach(([key, value]) => {
            (file as Record<string, unknown>)[key] = value as unknown;
          });
        }
        if (update?.$unset && typeof update.$unset === 'object') {
          Object.keys(update.$unset).forEach((key) => {
            delete (file as Record<string, unknown>)[key];
          });
        }
      });
      return { acknowledged: true, matchedCount: modified, modifiedCount: modified };
    }),
  };
  const Task = {
    findById: jest.fn((id: unknown) => ({
      lean: async () =>
        tasks.find((task) => String(task._id) === String(id)) || null,
    })),
    findOne: jest.fn((criteria: any = {}) => {
      const doc = tasks.find((task) => matchesCriteria(task, criteria)) || null;
      return wrapSingle(doc);
    }),
    find: jest.fn((criteria: any = {}) => {
      const docs = tasks.filter((task) => matchesCriteria(task, criteria));
      return wrapMulti(docs);
    }),
    updateOne: jest.fn(() => ({ exec: async () => undefined })),
  };
  return { File, Task, __store: storedFiles, __tasks: tasks };
});

let handleChunks: typeof import('../apps/api/src/routes/tasks').handleChunks;
let uploadsDir: string;
let deleteFile: typeof import('../apps/api/src/services/dataStorage').deleteFile;
let listFiles: typeof import('../apps/api/src/services/dataStorage').listFiles;
let filesRouter: express.Router;
let tempRoot: string;
let app: Express;
const maxUploadSize = 10 * 1024 * 1024;

async function uploadViaChunks(
  fileId: string,
  chunks: Buffer[],
  filename: string,
  mimetype: string,
  extraFields: Record<string, string> = {},
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
    let builder = request(app)
      .post('/upload-chunk')
      .field('fileId', fileId)
      .field('chunkIndex', String(index))
      .field('totalChunks', String(chunks.length));
    Object.entries(extraFields).forEach(([key, value]) => {
      builder = builder.field(key, value);
    });
    const interim = await builder.attach('file', chunks[index], {
      filename,
      contentType: mimetype,
    });
    expect(interim.status).toBe(200);
    expect(interim.body.received).toBe(index);
  }
  const lastIndex = chunks.length - 1;
  let finalBuilder = request(app)
    .post('/upload-chunk')
    .field('fileId', fileId)
    .field('chunkIndex', String(lastIndex))
    .field('totalChunks', String(chunks.length));
  Object.entries(extraFields).forEach(([key, value]) => {
    finalBuilder = finalBuilder.field(key, value);
  });
  const finalResponse = await finalBuilder.attach('file', chunks[lastIndex], {
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
  ({ scanFile } = require('../apps/api/src/services/antivirus') as {
    scanFile: jest.MockedFunction<(target: string) => Promise<boolean>>;
  });
  const tasksModule = await import('../apps/api/src/routes/tasks');
  handleChunks = tasksModule.handleChunks;
  ({ uploadsDir } = await import('../apps/api/src/config/storage'));
  ({ deleteFile, listFiles } = await import('../apps/api/src/services/dataStorage'));
  ({ default: filesRouter } = await import('../apps/api/src/routes/files'));
  app = express();
  const limiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
  const setUser: RequestHandler = (req, _res, next) => {
    (req as any).user = { id: currentUserId };
    next();
  };
  const chunkUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
      if (checkFile(file)) {
        cb(null, true);
        return;
      }
      cb(new Error('Недопустимый тип файла'));
    },
    limits: { fileSize: maxUploadSize },
  });
  app.post('/upload-chunk', setUser, limiter, (req, res, next) => {
    chunkUpload.single('file')(req, res, (err: unknown) => {
      if (err) {
        const error = err as Error;
        res.status(400).json({ error: error.message });
        return;
      }
      (handleChunks as unknown as RequestHandler)(req, res, next);
    });
  });
  app.use('/api/v1/files', filesRouter);
});

beforeEach(() => {
  storedFiles.length = 0;
  scanFile.mockClear();
  const { Task, __tasks } = require('../apps/api/src/db/model') as {
    Task: { findOne: jest.Mock };
    __tasks: Array<Record<string, unknown>>;
  };
  Task.findOne.mockClear();
  __tasks.length = 0;
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
      'report.png',
      'image/png',
    );
    expect(attachment.name).toBe('report.png');
    expect(attachment.url).toMatch(/\/api\/v1\/files\//);
    const absolute = path.resolve(uploadsDir, storedPath);
    expect(fs.existsSync(absolute)).toBe(true);
    expect(fs.readFileSync(absolute).toString()).toBe(content.toString());
    expect(storedPath.startsWith(`${currentUserId}/`)).toBe(true);
    expect(scanFile).toHaveBeenCalledWith(absolute);
  });

  test('возвращает 400, если чанк пришёл без файла', async () => {
    const response = await request(app)
      .post('/upload-chunk')
      .field('fileId', 'missing')
      .field('chunkIndex', '0')
      .field('totalChunks', '1');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Файл не получен' });
    expect(storedFiles).toHaveLength(0);
    expect(scanFile).not.toHaveBeenCalled();
  });

  test('загружает PDF документ', async () => {
    const chunks = [Buffer.from('%PDF-1.4\nERM test document')];
    const { attachment, storedPath } = await uploadViaChunks(
      'chunk-pdf',
      chunks,
      'contract.pdf',
      'application/pdf',
    );
    expect(attachment.name).toBe('contract.pdf');
    const stored = storedFiles.find((f) => f.path === storedPath);
    expect(stored?.type).toBe('application/pdf');
  });

  test('загружает документ DOCX', async () => {
    const chunks = [
      Buffer.from('PK\u0003\u0004\u0014\u0000\u0006\u0000\u0008\u0000\u0000\u0000!\u0000ERM docx test'),
    ];
    const { attachment, storedPath } = await uploadViaChunks(
      'chunk-docx',
      chunks,
      'spec.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(attachment.name).toBe('spec.docx');
    const stored = storedFiles.find((f) => f.path === storedPath);
    expect(stored?.type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
  });

  test('принимает допустимое расширение с неопределённым MIME', async () => {
    const chunks = [Buffer.from('Unknown mime chunk data')];
    const { attachment, storedPath } = await uploadViaChunks(
      'chunk-octet',
      chunks,
      'instruction.pdf',
      'application/octet-stream',
    );
    expect(attachment.name).toBe('instruction.pdf');
    const stored = storedFiles.find((f) => f.path === storedPath);
    expect(stored?.type).toBe('application/pdf');
  });

  test('привязывает файл к задаче при переданном taskId', async () => {
    const chunks = [Buffer.from('Task attachment payload')];
    const taskId = new Types.ObjectId().toHexString();
    const { attachment } = await uploadViaChunks(
      'chunk-linked',
      chunks,
      'linked.png',
      'image/png',
      { taskId },
    );
    const match = attachment.url.match(/\/api\/v1\/files\/([0-9a-f]{24})/i);
    expect(match).not.toBeNull();
    const fileId = match?.[1];
    const stored = storedFiles.find((f) => String(f._id) === String(fileId));
    expect(stored).toBeDefined();
    expect(String(stored?.taskId)).toBe(taskId);
  });

  test('игнорирует ошибку создания миниатюры и возвращает вложение', async () => {
    sharpToFileMock.mockRejectedValueOnce(new Error('pngload: libspng read error'));
    const chunks = [Buffer.from('thumb fail image')];
    const { attachment, storedPath } = await uploadViaChunks(
      'thumb-fail',
      chunks,
      'preview.png',
      'image/png',
    );
    expect(attachment.name).toBe('preview.png');
    expect(attachment.thumbnailUrl).toBeUndefined();
    const stored = storedFiles.find((f) => f.path === storedPath);
    expect(stored?.thumbnailPath).toBeUndefined();
  });

  test('позволяет скачать собранный файл', async () => {
    const chunks = [Buffer.from('first '), Buffer.from('second')];
    const { attachment, content } = await uploadViaChunks(
      'chunk-download',
      chunks,
      'notes.png',
      'image/png',
    );
    const response = await request(app).get(attachment.url).buffer(true);
    expect(response.status).toBe(200);
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(Buffer.compare(response.body as Buffer, content)).toBe(0);
  });

  test('привязывает файл к задаче по номеру при загрузке чанками', async () => {
    const { Task, __tasks } = require('../apps/api/src/db/model') as {
      Task: { findOne: jest.Mock };
      __tasks: Array<Record<string, unknown>>;
    };
    const taskId = new Types.ObjectId();
    __tasks.push({
      _id: taskId,
      task_number: 'ERM-123',
      request_id: 'ERM-123',
      title: 'Заявка на материалы',
      attachments: [],
    });
    const chunks = [Buffer.from('Task attachment payload')];
    const { attachment } = await uploadViaChunks(
      'chunk-link-task',
      chunks,
      'task.txt',
      'text/plain',
      { taskId: 'ERM-123' },
    );
    expect(storedFiles).toHaveLength(1);
    const stored = storedFiles[0];
    expect(String(stored.taskId)).toBe(String(taskId));
    const files = await listFiles({ userId: currentUserId });
    expect(files).toHaveLength(1);
    expect(files[0].taskId).toBe(String(taskId));
    expect(files[0].taskNumber).toBe('ERM-123');
    expect(files[0].url).toBe(attachment.url);
    expect(Task.findOne).toHaveBeenCalledWith({
      $or: [{ task_number: 'ERM-123' }, { request_id: 'ERM-123' }],
    });
  });

  test('удаляет файл и запись через deleteFile', async () => {
    const chunks = [Buffer.from('A '), Buffer.from('B')];
    const { attachment, storedPath } = await uploadViaChunks(
      'chunk-delete',
      chunks,
      'todo.png',
      'image/png',
    );
    const absolute = path.resolve(uploadsDir, storedPath);
    await deleteFile(storedPath);
    expect(fs.existsSync(absolute)).toBe(false);
    expect(storedFiles).toHaveLength(0);
    const res = await request(app).get(attachment.url);
    expect(res.status).toBe(404);
  });
  test('отклоняет загрузку с недопустимым типом', async () => {
    const response = await request(app)
      .post('/upload-chunk')
      .field('fileId', 'bad-type')
      .field('chunkIndex', '0')
      .field('totalChunks', '1')
      .attach('file', Buffer.from('executable'), {
        filename: 'tool.exe',
        contentType: 'application/octet-stream',
      });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Недопустимый тип файла');
  });

  test('возвращает 400, если файл не передан', async () => {
    const response = await request(app)
      .post('/upload-chunk')
      .field('fileId', 'missing-file')
      .field('chunkIndex', '0')
      .field('totalChunks', '1');
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Файл не получен');
    expect(storedFiles).toHaveLength(0);
    const chunkDir = path.join(uploadsDir, String(currentUserId), 'missing-file');
    expect(fs.existsSync(chunkDir)).toBe(false);
  });

  test('отклоняет файл больше 10 МБ после сборки', async () => {
    const largeChunk = Buffer.alloc(6 * 1024 * 1024, 1);
    const first = await request(app)
      .post('/upload-chunk')
      .field('fileId', 'too-large')
      .field('chunkIndex', '0')
      .field('totalChunks', '2')
      .attach('file', largeChunk, {
        filename: 'oversize.png',
        contentType: 'image/png',
      });
    expect(first.status).toBe(200);
    expect(first.body.received).toBe(0);
    const second = await request(app)
      .post('/upload-chunk')
      .field('fileId', 'too-large')
      .field('chunkIndex', '1')
      .field('totalChunks', '2')
      .attach('file', largeChunk, {
        filename: 'oversize.png',
        contentType: 'image/png',
      });
    expect(second.status).toBe(400);
    expect(second.body.error).toBe('Файл превышает допустимый размер');
    expect(storedFiles).toHaveLength(0);
  });

  test('отклоняет файл при срабатывании антивируса', async () => {
    scanFile.mockResolvedValueOnce(false);
    const chunkA = Buffer.from('suspicious ');
    const chunkB = Buffer.from('payload');
    const first = await request(app)
      .post('/upload-chunk')
      .field('fileId', 'virus-check')
      .field('chunkIndex', '0')
      .field('totalChunks', '2')
      .attach('file', chunkA, {
        filename: 'archive.zip',
        contentType: 'application/zip',
      });
    expect(first.status).toBe(200);
    expect(first.body.received).toBe(0);
    const second = await request(app)
      .post('/upload-chunk')
      .field('fileId', 'virus-check')
      .field('chunkIndex', '1')
      .field('totalChunks', '2')
      .attach('file', chunkB, {
        filename: 'archive.zip',
        contentType: 'application/zip',
      });
    expect(second.status).toBe(400);
    expect(second.body.error).toBe('Файл содержит вирус');
    expect(scanFile).toHaveBeenCalledTimes(1);
    expect(storedFiles).toHaveLength(0);
    const userDir = path.join(uploadsDir, String(currentUserId));
    if (fs.existsSync(userDir)) {
      expect(fs.readdirSync(userDir)).toHaveLength(0);
    }
  });

  test('очищает устаревшие несвязанные файлы перед проверкой лимитов', async () => {
    const staleAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    for (let index = 0; index < 20; index += 1) {
      storedFiles.push({
        _id: new Types.ObjectId(),
        userId: currentUserId,
        name: `old-${index}.png`,
        path: path.join(String(currentUserId), `old-${index}.png`),
        type: 'image/png',
        size: 1024,
        uploadedAt: staleAt,
        taskId: null,
        draftId: null,
      });
    }
    const response = await request(app)
      .post('/upload-chunk')
      .field('fileId', 'stale-cleanup')
      .field('chunkIndex', '0')
      .field('totalChunks', '1')
      .attach('file', Buffer.from('fresh'), {
        filename: 'fresh.png',
        contentType: 'image/png',
      });
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('fresh.png');
    expect(storedFiles).toHaveLength(21);
    const latest = storedFiles[storedFiles.length - 1];
    expect(latest.name).toBe('fresh.png');
    expect(latest.taskId).toBeNull();
  });
});
