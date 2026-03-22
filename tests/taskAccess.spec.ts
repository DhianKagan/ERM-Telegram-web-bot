import type { NextFunction, Response } from 'express';
import checkTaskAccess from '../apps/api/src/middleware/taskAccess';
import { ACCESS_MANAGER } from '../apps/api/src/utils/accessMask';
import type { RequestWithUser } from '../apps/api/src/types/request';

jest.mock('../apps/api/src/services/tasks', () => ({
  getById: jest.fn(),
}));

jest.mock('../apps/api/src/services/service', () => ({
  writeLog: jest.fn().mockResolvedValue(undefined),
}));

const getByIdMock = jest.requireMock('../apps/api/src/services/tasks')
  .getById as jest.MockedFunction<
  typeof import('../apps/api/src/services/tasks').getById
>;

describe('checkTaskAccess', () => {
  const res = {} as Response;
  const toRequest = (
    value: Partial<RequestWithUser> & {
      route: { path: string };
      originalUrl: string;
      method: string;
      params: { id: string };
      body: Record<string, unknown>;
    },
  ): RequestWithUser => value as RequestWithUser;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('разрешает исполнителю менять статус, если assignees сохранены объектами', async () => {
    getByIdMock.mockResolvedValue({
      _id: 'task-1',
      created_by: 100,
      status: 'Новая',
      assignees: [{ telegram_id: 404 }, { user_id: 505 }],
    });

    const req = toRequest({
      params: { id: 'task-1' },
      method: 'PATCH',
      route: { path: '/:id/status' },
      originalUrl: '/api/v1/tasks/task-1/status',
      body: { status: 'В работе' },
      user: { id: 404, username: 'executor' },
    });
    const next = jest.fn() as unknown as NextFunction;

    await checkTaskAccess(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.task).toMatchObject({ _id: 'task-1' });
  });

  it('разрешает менеджеру менять задачу, если controllers сохранены объектами', async () => {
    getByIdMock.mockResolvedValue({
      _id: 'task-2',
      created_by: 100,
      status: 'В работе',
      controllers: [{ id: 808 }],
    });

    const req = toRequest({
      params: { id: 'task-2' },
      method: 'PATCH',
      route: { path: '/:id' },
      originalUrl: '/api/v1/tasks/task-2',
      body: { title: 'Обновлённый заголовок' },
      user: { id: 808, username: 'manager', access: ACCESS_MANAGER },
    });
    const next = jest.fn() as unknown as NextFunction;

    await checkTaskAccess(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.task).toMatchObject({ _id: 'task-2' });
  });
});
