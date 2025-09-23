/**
 * Назначение файла: тесты привязки вложений к задачам и проверки доступа.
 * Основные модули: jest, supertest, express.
 */
import express = require('express');
import request = require('supertest');
import { Types } from 'mongoose';
import type { RequestHandler } from 'express';

const createdTaskId = new Types.ObjectId();
const existingTaskId = new Types.ObjectId();
const fileId = new Types.ObjectId();

const taskCreateMock = jest.fn(async (data: any) => ({
  ...data,
  _id: createdTaskId,
}));
const taskFindByIdMock = jest.fn(async () => ({
  _id: existingTaskId,
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
const taskFindByIdAndUpdateMock = jest.fn(async () => ({
  _id: existingTaskId,
  attachments: [],
}));
const fileUpdateManyMock = jest.fn(async () => ({}));

jest.mock('../src/db/model', () => ({
  Task: {
    create: taskCreateMock,
    findById: taskFindByIdMock,
    findByIdAndUpdate: taskFindByIdAndUpdateMock,
  },
  Archive: {},
  User: {},
  Role: {},
  File: {
    updateMany: fileUpdateManyMock,
  },
  RoleAttrs: {},
  TaskTemplate: {},
  TaskTemplateDocument: {},
  HistoryEntry: {},
}));

jest.mock('../src/services/wgLogEngine', () => ({
  writeLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/services/tasks', () => ({
  getById: jest.fn(async () => ({
    _id: existingTaskId,
    created_by: 1,
    assignees: [],
    controllers: [],
  })),
}));

const { createTask, updateTask } = require('../src/db/queries');
const checkTaskAccess = require('../src/middleware/taskAccess').default as RequestHandler;
const { ACCESS_USER } = require('../src/utils/accessMask');

describe('Привязка вложений к задачам', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(taskCreateMock).toHaveBeenCalled();
    expect(fileUpdateManyMock).toHaveBeenNthCalledWith(
      1,
      {
        _id: { $in: [fileId] },
        $or: [{ userId: 7 }, { taskId: createdTaskId }],
      },
      { $set: { taskId: createdTaskId } },
    );
    expect(fileUpdateManyMock).toHaveBeenNthCalledWith(
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
    expect(fileUpdateManyMock).toHaveBeenCalledWith(
      { taskId: existingTaskId },
      { $unset: { taskId: '' } },
    );
  });
});

describe('Проверка доступа к задаче другим пользователем', () => {
  test('возвращает 403 при попытке обновления без прав', async () => {
    const app = express();
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
});
