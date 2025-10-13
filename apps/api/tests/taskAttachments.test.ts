/**
 * Назначение файла: тесты привязки вложений к задачам и проверки доступа.
 * Основные модули: jest, supertest, express.
 */
import express = require('express');
import request = require('supertest');
import { Types } from 'mongoose';
import type { RequestHandler } from 'express';

const createdTaskId = new Types.ObjectId();
const mockExistingTaskId = new Types.ObjectId();
const existingTaskId = mockExistingTaskId;
const fileId = new Types.ObjectId();

const mockTaskCreate = jest.fn(async (data: any) => ({
  ...data,
  _id: createdTaskId,
}));
const mockTaskFindById = jest.fn(async () => ({
  _id: existingTaskId,
  status: 'Новая',
  attachments: [
    {
      name: 'file.txt',
      url: `/api/v1/files/${fileId}`,
      uploadedBy: 1,
      uploadedAt: new Date(),
      type: 'text/plain',
      size: 10,
    },
  ],
}));
const mockTaskFindOneAndUpdate = jest.fn(async () => ({
  _id: existingTaskId,
  attachments: [],
}));
const mockFileUpdateMany = jest.fn(async () => ({}));

jest.mock('../src/db/model', () => ({
  Task: {
    create: mockTaskCreate,
    findById: mockTaskFindById,
    findOneAndUpdate: mockTaskFindOneAndUpdate,
  },
  Archive: {},
  User: {},
  Role: {},
  File: {
    updateMany: mockFileUpdateMany,
  },
  RoleAttrs: {},
  TaskTemplate: {},
  TaskTemplateDocument: {},
  HistoryEntry: {},
}));

jest.mock('../src/services/wgLogEngine', () => ({
  writeLog: jest.fn().mockResolvedValue(undefined),
}));

const getByIdMock = jest.fn(async () => ({
  _id: mockExistingTaskId,
  created_by: 1,
  status: 'Новая',
  assignees: [],
  controllers: [],
}));

jest.mock('../src/services/tasks', () => ({
  getById: getByIdMock,
}));

const { createTask, updateTask } = require('../src/db/queries');
const checkTaskAccess = require('../src/middleware/taskAccess').default as RequestHandler;
const { ACCESS_USER } = require('../src/utils/accessMask');
const tasksService = require('../src/services/tasks');
const mockedGetById = tasksService.getById as jest.Mock;

const defaultTaskAccess = {
  _id: mockExistingTaskId,
  created_by: 1,
  status: 'Новая',
  assignees: [] as Array<number>,
  controllers: [] as Array<number>,
};

describe('Привязка вложений к задачам', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetById.mockResolvedValue({ ...defaultTaskAccess });
  });

  test('устанавливает taskId после создания задачи', async () => {
    const attachments = [
      {
        name: 'file.txt',
        url: `/api/v1/files/${fileId}`,
        uploadedBy: 7,
        uploadedAt: new Date(),
        type: 'text/plain',
        size: 10,
      },
    ];
    await createTask({ attachments }, 7);
    expect(mockTaskCreate).toHaveBeenCalled();
    expect(mockFileUpdateMany).toHaveBeenNthCalledWith(
      1,
      {
        _id: { $in: [fileId] },
        $or: [{ userId: 7 }, { taskId: createdTaskId }],
      },
      { $set: { taskId: createdTaskId } },
    );
    expect(mockFileUpdateMany).toHaveBeenNthCalledWith(
      2,
      {
        taskId: createdTaskId,
        _id: { $nin: [fileId] },
      },
      { $unset: { taskId: '' } },
    );
  });

  test('очищает привязку файлов при удалении вложения', async () => {
    const result = await updateTask(
      String(existingTaskId),
      { attachments: [] },
      1,
    );
    expect(result).not.toBeNull();
    expect(mockFileUpdateMany).toHaveBeenCalledWith(
      { taskId: existingTaskId },
      { $unset: { taskId: '' } },
    );
  });

  test('парсит строковое представление вложений при обновлении', async () => {
    const iso = new Date().toISOString();
    const raw = `[
      {
        name: 'doc.pdf',
        url: '/api/v1/files/${fileId}',
        uploadedBy: '7',
        uploadedAt: '${iso}',
        type: 'application/pdf',
        size: '512'
      }
    ]`;

    await updateTask(
      String(existingTaskId),
      { attachments: raw } as unknown as Record<string, unknown>,
      1,
    );

    const call = mockTaskFindOneAndUpdate.mock.calls[0];
    expect(call).toBeTruthy();
    expect(call[0]).toMatchObject({ status: 'Новая' });
    const setArg = call[1]?.$set as { attachments?: unknown[] };
    expect(Array.isArray(setArg.attachments)).toBe(true);
    const [attachment] = setArg.attachments as Record<string, unknown>[];
    expect(attachment.url).toBe(`/api/v1/files/${fileId}`);
    expect(attachment.name).toBe('doc.pdf');
    expect(attachment.type).toBe('application/pdf');
    expect(attachment.size).toBe(512);
    expect(attachment.uploadedBy).toBe(7);
    expect(attachment.uploadedAt).toBeInstanceOf(Date);
  });
});

describe('Проверка доступа к задаче другим пользователем', () => {
  beforeEach(() => {
    mockedGetById.mockResolvedValue({ ...defaultTaskAccess });
  });

  test('возвращает 403 при попытке обновления без прав', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: 99, access: ACCESS_USER };
      next();
    });
    app.patch('/tasks/:id', checkTaskAccess, (_req, res) => {
      res.json({ ok: true });
    });
    const response = await request(app).patch(`/tasks/${existingTaskId}`);
    expect(response.status).toBe(403);
  });

  test('создатель новой задачи может обновлять поля', async () => {
    mockedGetById.mockResolvedValue({
      ...defaultTaskAccess,
      created_by: 7,
      status: 'Новая',
    });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: 7, access: ACCESS_USER };
      next();
    });
    app.patch('/tasks/:id', checkTaskAccess, (_req, res) => {
      res.json({ ok: true });
    });
    const response = await request(app)
      .patch(`/tasks/${existingTaskId}`)
      .send({ title: 'Обновлено' });
    expect(response.status).toBe(200);
  });

  test('создатель не может редактировать задачу в работе', async () => {
    mockedGetById.mockResolvedValue({
      ...defaultTaskAccess,
      created_by: 7,
      status: 'В работе',
    });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: 7, access: ACCESS_USER };
      next();
    });
    app.patch('/tasks/:id', checkTaskAccess, (_req, res) => {
      res.json({ ok: true });
    });
    const response = await request(app)
      .patch(`/tasks/${existingTaskId}`)
      .send({ title: 'Нельзя' });
    expect(response.status).toBe(403);
  });

  test('исполнитель может обновить только статус', async () => {
    mockedGetById.mockResolvedValue({
      ...defaultTaskAccess,
      created_by: 10,
      assignees: [8],
    });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: 8, access: ACCESS_USER };
      next();
    });
    app.patch('/tasks/:id', checkTaskAccess, (_req, res) => {
      res.json({ ok: true });
    });
    const response = await request(app)
      .patch(`/tasks/${existingTaskId}`)
      .send({ status: 'В работе' });
    expect(response.status).toBe(200);
  });

  test('исполнитель не может менять другие поля', async () => {
    mockedGetById.mockResolvedValue({
      ...defaultTaskAccess,
      created_by: 10,
      assignees: [8],
    });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: 8, access: ACCESS_USER };
      next();
    });
    app.patch('/tasks/:id', checkTaskAccess, (_req, res) => {
      res.json({ ok: true });
    });
    const response = await request(app)
      .patch(`/tasks/${existingTaskId}`)
      .send({ priority: 'Срочно' });
    expect(response.status).toBe(403);
  });

  test('создатель-исполнитель не меняет статус после старта', async () => {
    mockedGetById.mockResolvedValue({
      ...defaultTaskAccess,
      created_by: 12,
      assignees: [12],
      status: 'В работе',
    });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: 12, access: ACCESS_USER };
      next();
    });
    app.patch('/tasks/:id/status', checkTaskAccess, (_req, res) => {
      res.json({ ok: true });
    });
    const response = await request(app)
      .patch(`/tasks/${existingTaskId}/status`)
      .send({ status: 'Выполнена' });
    expect(response.status).toBe(403);
  });

  test('исполнитель может сменить статус через отдельный роут', async () => {
    mockedGetById.mockResolvedValue({
      ...defaultTaskAccess,
      created_by: 14,
      assignees: [15],
    });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: 15, access: ACCESS_USER };
      next();
    });
    app.patch('/tasks/:id/status', checkTaskAccess, (_req, res) => {
      res.json({ ok: true });
    });
    const response = await request(app)
      .patch(`/tasks/${existingTaskId}/status`)
      .send({ status: 'В работе' });
    expect(response.status).toBe(200);
  });
});
