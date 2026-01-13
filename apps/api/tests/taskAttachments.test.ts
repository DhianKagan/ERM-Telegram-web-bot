/**
 * Назначение файла: тесты привязки вложений к задачам и проверки доступа.
 * Основные модули: jest, supertest, express.
 */
import express from 'express';
import request from 'supertest';
import { Types } from 'mongoose';
import type { NextFunction, Response } from 'express';
import type { RequestWithUser } from './helpers/express';
import checkTaskAccess from '../src/middleware/taskAccess';
import { createTask, updateTask } from '../src/db/queries';
import { ACCESS_USER } from '../src/utils/accessMask';
import * as tasksService from '../src/services/tasks';

const createdTaskId = new Types.ObjectId();
const mockExistingTaskId = new Types.ObjectId();
const existingTaskId = mockExistingTaskId;
const fileId = new Types.ObjectId();

type UpdateArgs = [
  Record<string, unknown>,
  { $set?: { attachments?: unknown[] }; [key: string]: unknown }?,
];

jest.mock('../src/db/model', () => ({
  Task: {
    create: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  Archive: {},
  User: {},
  Role: {},
  File: {
    updateMany: jest.fn(),
    find: jest.fn(),
    bulkWrite: jest.fn(),
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
  getById: jest.fn(),
}));

const models = jest.requireMock('../src/db/model') as {
  Task: {
    create: jest.Mock;
    findById: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };
  File: { updateMany: jest.Mock; find: jest.Mock; bulkWrite: jest.Mock };
};
const mockTaskCreate = models.Task.create as jest.Mock;
const mockTaskFindById = models.Task.findById as jest.Mock;
const mockTaskFindOneAndUpdate = models.Task.findOneAndUpdate as jest.Mock<
  Promise<{ _id: typeof existingTaskId; attachments: unknown[] }>,
  UpdateArgs
>;
const mockFileUpdateMany = models.File.updateMany as jest.Mock;
const mockFileFind = models.File.find as jest.Mock;
const mockFileBulkWrite = models.File.bulkWrite as jest.Mock;

mockTaskCreate.mockImplementation(async (data: Record<string, unknown>) => ({
  ...data,
  _id: createdTaskId,
}));
mockTaskFindById.mockImplementation(async () => ({
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
mockTaskFindOneAndUpdate.mockImplementation(async () => ({
  _id: existingTaskId,
  attachments: [],
}));
mockFileUpdateMany.mockImplementation(async () => ({}));
mockFileFind.mockImplementation(() => ({
  lean: jest.fn().mockResolvedValue([]),
}));
mockFileBulkWrite.mockImplementation(async () => ({}));

const mockedGetById = tasksService.getById as jest.Mock;

const defaultTaskAccess = {
  _id: mockExistingTaskId,
  created_by: 1,
  status: 'Новая',
  assignees: [] as Array<number>,
  controllers: [] as Array<number>,
};

type TestUser = { id: number; access: number };

// Хелпер создаёт Express-приложение с префиксом /tasks и предзаполненным пользователем.
const createTasksApp = (
  user: TestUser,
  register: (router: express.Router) => void,
) => {
  const app = express();
  app.use(express.json());
  app.use((req: RequestWithUser, _res: Response, next: NextFunction) => {
    req.user = user;
    next();
  });
  const router = express.Router();
  register(router);
  app.use('/tasks', router);
  return app;
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
      {
        $set: { taskId: createdTaskId, detached: false, scope: 'task' },
        $unset: { draftId: '' },
        $addToSet: { relatedTaskIds: createdTaskId },
      },
    );
  });

  test('разрешает первичную привязку вложений без идентификатора пользователя', async () => {
    const attachments = [
      {
        name: 'unsigned.txt',
        url: `/api/v1/files/${fileId}`,
        uploadedAt: new Date(),
        type: 'text/plain',
        size: 5,
      },
    ];
    await createTask({ attachments });
    expect(mockFileUpdateMany).toHaveBeenNthCalledWith(
      1,
      {
        _id: { $in: [fileId] },
        $or: [
          { taskId: createdTaskId },
          {
            taskId: null,
            $or: [{ userId: null }, { userId: { $exists: false } }],
          },
        ],
      },
      {
        $set: { taskId: createdTaskId, detached: false, scope: 'task' },
        $unset: { draftId: '' },
        $addToSet: { relatedTaskIds: createdTaskId },
      },
    );
  });

  test('распознаёт идентификатор файла с фрагментом URL', async () => {
    const attachments = [
      {
        name: 'diagram.png',
        url: `https://example.com/api/v1/files/${fileId}#viewer`,
        uploadedBy: 7,
        uploadedAt: new Date(),
        type: 'image/png',
        size: 42,
      },
    ];
    await createTask({ attachments }, 7);
    expect(mockFileUpdateMany).toHaveBeenNthCalledWith(
      1,
      {
        _id: { $in: [fileId] },
        $or: [{ userId: 7 }, { taskId: createdTaskId }],
      },
      {
        $set: { taskId: createdTaskId, detached: false, scope: 'task' },
        $unset: { draftId: '' },
        $addToSet: { relatedTaskIds: createdTaskId },
      },
    );
  });

  test('очищает привязку файлов при удалении вложения', async () => {
    const result = await updateTask(
      String(existingTaskId),
      { attachments: [] },
      1,
    );
    expect(result).not.toBeNull();
    expect(mockFileUpdateMany).not.toHaveBeenCalled();
    expect(mockFileFind).toHaveBeenCalledWith({
      $or: [{ taskId: existingTaskId }, { relatedTaskIds: existingTaskId }],
    });
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

    const call = mockTaskFindOneAndUpdate.mock.calls[0]!;
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
    const app = createTasksApp({ id: 99, access: ACCESS_USER }, (router) => {
      router.patch('/:id', checkTaskAccess, (_req, res) => {
        res.json({ ok: true });
      });
    });
    const response = await request(app).patch(`/tasks/${existingTaskId}`);
    expect(response.status).toBe(403);
  });

  test('создатель без прав не редактирует даже новую задачу', async () => {
    mockedGetById.mockResolvedValue({
      ...defaultTaskAccess,
      created_by: 7,
      status: 'Новая',
    });
    const app = createTasksApp({ id: 7, access: ACCESS_USER }, (router) => {
      router.patch('/:id', checkTaskAccess, (_req, res) => {
        res.json({ ok: true });
      });
    });
    const response = await request(app)
      .patch(`/tasks/${existingTaskId}`)
      .send({ title: 'Обновлено' });
    expect(response.status).toBe(403);
  });

  test('создатель не может редактировать задачу в работе', async () => {
    mockedGetById.mockResolvedValue({
      ...defaultTaskAccess,
      created_by: 7,
      status: 'В работе',
    });
    const app = createTasksApp({ id: 7, access: ACCESS_USER }, (router) => {
      router.patch('/:id', checkTaskAccess, (_req, res) => {
        res.json({ ok: true });
      });
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
    const app = createTasksApp({ id: 8, access: ACCESS_USER }, (router) => {
      router.patch('/:id', checkTaskAccess, (_req, res) => {
        res.json({ ok: true });
      });
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
    const app = createTasksApp({ id: 8, access: ACCESS_USER }, (router) => {
      router.patch('/:id', checkTaskAccess, (_req, res) => {
        res.json({ ok: true });
      });
    });
    const response = await request(app)
      .patch(`/tasks/${existingTaskId}`)
      .send({ priority: 'Срочно' });
    expect(response.status).toBe(403);
  });

  test('создатель-исполнитель может завершить задачу после старта', async () => {
    mockedGetById.mockResolvedValue({
      ...defaultTaskAccess,
      created_by: 12,
      assignees: [12],
      status: 'В работе',
    });
    const app = createTasksApp({ id: 12, access: ACCESS_USER }, (router) => {
      router.patch('/:id/status', checkTaskAccess, (_req, res) => {
        res.json({ ok: true });
      });
    });
    const response = await request(app)
      .patch(`/tasks/${existingTaskId}/status`)
      .send({ status: 'Выполнена' });
    expect(response.status).toBe(200);
  });

  test('исполнитель может сменить статус через отдельный роут', async () => {
    mockedGetById.mockResolvedValue({
      ...defaultTaskAccess,
      created_by: 14,
      assignees: [15],
    });
    const app = createTasksApp({ id: 15, access: ACCESS_USER }, (router) => {
      router.patch('/:id/status', checkTaskAccess, (_req, res) => {
        res.json({ ok: true });
      });
    });
    const response = await request(app)
      .patch(`/tasks/${existingTaskId}/status`)
      .send({ status: 'В работе' });
    expect(response.status).toBe(200);
  });
});
