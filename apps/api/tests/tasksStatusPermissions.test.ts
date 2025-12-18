// Назначение: проверка прав на смену статуса задач
// Основные модули: jest
import { Task } from '../src/db/model';
import * as queries from '../src/db/queries';
import {
  ACCESS_ADMIN,
  ACCESS_MANAGER,
  ACCESS_TASK_DELETE,
} from '../src/utils/accessMask';

jest.mock('../src/db/model', () => ({
  Task: {
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

describe('updateTaskStatus permissions', () => {
  const baseTask = {
    _id: 'task-1',
    status: 'Новая' as const,
    assigned_user_id: 10,
    assignees: [20],
    created_by: 5,
    in_progress_at: null,
    completed_at: null,
  };

  beforeEach(() => {
    (Task.findById as jest.Mock).mockResolvedValue({ ...baseTask });
    (Task.findOneAndUpdate as jest.Mock).mockClear();
    (Task.findOneAndUpdate as jest.Mock).mockImplementation(
      (_query, update) => ({
        exec: jest.fn().mockResolvedValue({
          ...baseTask,
          ...(update?.$set ?? update ?? {}),
        }),
      }),
    );
  });

  it('разрешает смену статуса создателю', async () => {
    const result = await queries.updateTaskStatus(
      'task-1',
      'В работе',
      baseTask.created_by,
    );

    expect(result?.status).toBe('В работе');
  });

  it('разрешает смену статуса любому исполнителю', async () => {
    const result = await queries.updateTaskStatus('task-1', 'Выполнена', 20);

    expect(result?.status).toBe('Выполнена');
  });

  it('блокирует стороннего пользователя без adminOverride', async () => {
    await expect(
      queries.updateTaskStatus('task-1', 'В работе', 999),
    ).rejects.toHaveProperty('code', 'TASK_STATUS_FORBIDDEN');

    expect(Task.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('позволяет adminOverride менять статус', async () => {
    const result = await queries.updateTaskStatus(
      'task-1',
      'В работе',
      999,
      {
        adminOverride: true,
        actorAccess: ACCESS_TASK_DELETE,
      },
    );

    expect(result?.status).toBe('В работе');
  });

  it('запрещает менять финальный статус без adminOverride', async () => {
    (Task.findById as jest.Mock).mockResolvedValue({
      ...baseTask,
      status: 'Выполнена',
    });

    await expect(
      queries.updateTaskStatus('task-1', 'Новая', 5),
    ).rejects.toHaveProperty('code', 'TASK_STATUS_FORBIDDEN');

    expect(Task.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('разрешает менять финальный статус с adminOverride', async () => {
    (Task.findById as jest.Mock).mockResolvedValue({
      ...baseTask,
      status: 'Отменена',
    });

    const result = await queries.updateTaskStatus(
      'task-1',
      'В работе',
      999,
      {
        adminOverride: true,
        actorAccess: ACCESS_TASK_DELETE,
      },
    );

    expect(result?.status).toBe('В работе');
  });

  it('блокирует финальный статус для менеджера без уровня удаления', async () => {
    (Task.findById as jest.Mock).mockResolvedValue({
      ...baseTask,
      status: 'Выполнена',
    });

    await expect(
      queries.updateTaskStatus('task-1', 'В работе', 20, {
        actorAccess: ACCESS_MANAGER,
      }),
    ).rejects.toHaveProperty('code', 'TASK_STATUS_FORBIDDEN');
  });

  it('разрешает администратору без удаления отменять задачу', async () => {
    const result = await queries.updateTaskStatus('task-1', 'Отменена', 999, {
      actorAccess: ACCESS_ADMIN,
    });

    expect(result?.status).toBe('Отменена');
  });
});
