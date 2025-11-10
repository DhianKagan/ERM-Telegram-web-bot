// Назначение: тесты роутов управления файлами. Модули: jest, supertest.
import type { NextFunction, Request, Response } from 'express';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 's';
process.env.APP_URL = 'https://localhost';
process.env.MONGO_DATABASE_URL =
  'mongodb://admin:admin@localhost:27017/ermdb?authSource=admin';

const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');

const mockDiagnosticsController = {
  diagnose: jest.fn((_req: Request, res: Response) => res.json({ ok: true })),
  remediate: jest.fn((_req: Request, res: Response) => res.json({ ok: true })),
};

jest.mock('../src/di', () => {
  const resolve = jest.fn(() => mockDiagnosticsController);
  return {
    __esModule: true,
    default: { resolve },
    container: { resolve },
  };
});

const mockFileFind = jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) }));
const mockFileFindById = jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) }));
const mockFileFindOneAndDelete = jest.fn(() => ({
  lean: jest.fn().mockResolvedValue(null),
}));
const mockFileUpdateOne = jest.fn(() => ({
  exec: jest.fn().mockResolvedValue(undefined),
}));

type TaskQuery<T> = {
  select: jest.Mock<TaskQuery<T>, []>;
  lean: jest.Mock<Promise<T>, []>;
};

const createTaskQuery = <T>(result: T): TaskQuery<T> => {
  const query: Partial<TaskQuery<T>> = {};
  query.lean = jest.fn().mockResolvedValue(result);
  query.select = jest.fn().mockReturnValue(query as TaskQuery<T>);
  return query as TaskQuery<T>;
};

const mockTaskFind = jest.fn(() => createTaskQuery<unknown[]>([]));
const mockTaskFindOne = jest.fn(() => createTaskQuery<unknown>(null));
const mockTaskFindById = jest.fn(() => createTaskQuery<unknown>(null));

jest.mock('../src/db/model', () => ({
  File: {
    find: mockFileFind,
    findById: mockFileFindById,
    findOneAndDelete: mockFileFindOneAndDelete,
    updateOne: mockFileUpdateOne,
  },
  Task: {
    updateOne: jest.fn(),
    find: mockTaskFind,
    findOne: mockTaskFindOne,
    findById: mockTaskFindById,
  },
}));

process.env.STORAGE_DIR = path.resolve(__dirname, '../public/uploads');
const router = require('../src/routes/storage').default;
const { uploadsDir } = require('../src/config/storage');
const { File } = require('../src/db/model');
const { stopQueue } = require('../src/services/messageQueue');
const { stopScheduler } = require('../src/services/scheduler');

jest.mock('../src/middleware/auth', () =>
  () => (_req: unknown, _res: unknown, next: NextFunction) => next(),
);
jest.mock('../src/auth/roles.guard', () =>
  (_req: unknown, _res: unknown, next: NextFunction) => next(),
);
jest.mock('../src/auth/roles.decorator', () => ({
  Roles: () => (_req: unknown, _res: unknown, next: NextFunction) => next(),
}));

describe('storage routes', () => {
  const app = express();
  app.use(express.json());
  app.use(router);

  beforeEach(() => {
    mockFileFind.mockReset();
    mockFileFindById.mockReset();
    mockFileFindOneAndDelete.mockReset();
    mockFileUpdateOne.mockReset();
    mockFileUpdateOne.mockImplementation(() => ({
      exec: jest.fn().mockResolvedValue(undefined),
    }));
    mockTaskFind.mockReset();
    mockTaskFindOne.mockReset();
    mockTaskFindById.mockReset();
    mockTaskFind.mockImplementation(() => createTaskQuery<unknown[]>([]));
    mockTaskFindOne.mockImplementation(() => createTaskQuery<unknown>(null));
    mockTaskFindById.mockImplementation(() => createTaskQuery<unknown>(null));
  });

  test('list files', async () => {
    mockFileFind.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          userId: 1,
          name: 'test.txt',
          path: 'test.txt',
          type: 'text/plain',
          size: 1,
          uploadedAt: new Date(),
          _id: '64d000000000000000000001',
        },
      ]),
    });
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].name).toBe('test.txt');
    expect(res.body[0].previewUrl).toContain('?mode=inline');
    expect(res.body[0].id).toBe('64d000000000000000000001');
  });

  test('get file by id', async () => {
    mockFileFindById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: '64d000000000000000000002',
        userId: 2,
        name: 'single.txt',
        path: 'single.txt',
        type: 'text/plain',
        size: 2,
        uploadedAt: new Date(),
        taskId: '64d000000000000000000003',
      }),
    });
    mockTaskFindById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ task_number: 'A-2', title: 'Task' }),
        select: jest.fn().mockReturnThis(),
      }),
      lean: jest.fn().mockResolvedValue(null),
    });
    const res = await request(app).get('/64d000000000000000000002');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('single.txt');
    expect(res.body.taskNumber).toBe('A-2');
  });

  test('get file resolves taskId через поле files', async () => {
    const fileId = '64d000000000000000000099';
    const fallbackTaskId = '64d0000000000000000000aa';
    mockFileFindById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: fileId,
        userId: 3,
        name: 'preview.pdf',
        path: 'preview.pdf',
        type: 'application/pdf',
        size: 123,
        uploadedAt: new Date(),
      }),
    });
    mockTaskFindOne.mockImplementation(() =>
      createTaskQuery({
        _id: fallbackTaskId,
        task_number: 'ERM-55',
        title: 'Документы',
        attachments: [],
        files: [`/api/v1/files/${fileId}?mode=inline`],
      }),
    );

    const res = await request(app).get(`/${fileId}`);
    expect(res.status).toBe(200);
    expect(res.body.taskId).toBe(fallbackTaskId);
    expect(res.body.taskNumber).toBe('ERM-55');
    expect(mockFileUpdateOne).toHaveBeenCalledWith(
      { _id: fileId },
      expect.objectContaining({ $set: expect.objectContaining({ taskId: expect.anything() }) }),
    );
  });

  test('delete file', async () => {
    const f = path.join(uploadsDir, 'del.txt');
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(f, 'd');
    mockFileFindOneAndDelete.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        path: 'del.txt',
        _id: '64d000000000000000000004',
      }),
    });
    await request(app).delete('/64d000000000000000000004').expect(200);
    expect(fs.existsSync(f)).toBe(false);
  });

  test('diagnostics endpoint delegates to controller', async () => {
    await request(app).get('/diagnostics').expect(200);
    expect(mockDiagnosticsController.diagnose).toHaveBeenCalled();
  });

  test('remediate endpoint делегирует контроллеру', async () => {
    await request(app).post('/diagnostics/fix').expect(200);
    expect(mockDiagnosticsController.remediate).toHaveBeenCalled();
  });
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
