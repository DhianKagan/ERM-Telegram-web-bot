/**
 * Назначение файла: проверяет применение темы Telegram для типов задач.
 * Основные модули: TasksService, resolveTaskTypeTopicId.
 */
import TasksService from '../apps/api/src/tasks/tasks.service';
import type { TaskDocument } from '../apps/api/src/db/model';

jest.mock('../apps/api/src/services/route', () => ({
  getRouteDistance: jest.fn(),
  clearRouteCache: jest.fn(),
}));

jest.mock('../apps/api/src/intake/rules', () => ({
  applyIntakeRules: jest.fn(),
}));

jest.mock('../apps/api/src/services/wgLogEngine', () => ({
  writeLog: jest.fn(),
}));

jest.mock('../apps/api/src/utils/attachments', () => ({
  extractAttachmentIds: jest.fn(() => []),
}));

jest.mock('../apps/api/src/services/taskTypeSettings', () => ({
  resolveTaskTypeTopicId: jest.fn(),
}));

const { resolveTaskTypeTopicId } =
  jest.requireMock('../apps/api/src/services/taskTypeSettings');

type RepositoryMocks = {
  createTask: jest.Mock;
  updateTask: jest.Mock;
  addTime: jest.Mock;
  bulkUpdate: jest.Mock;
  getTasks: jest.Mock;
  getTask: jest.Mock;
  summary: jest.Mock;
  deleteTask: jest.Mock;
  listMentionedTasks: jest.Mock;
};

const createRepo = (): RepositoryMocks => ({
  createTask: jest.fn(async (data: Partial<TaskDocument>) => ({
    _id: 'task-id',
    ...(data as Record<string, unknown>),
  } as TaskDocument)),
  updateTask: jest.fn(async (_id: string, data: Partial<TaskDocument>) => ({
    _id,
    ...(data as Record<string, unknown>),
  } as TaskDocument)),
  addTime: jest.fn(),
  bulkUpdate: jest.fn(),
  getTasks: jest.fn(),
  getTask: jest.fn(),
  summary: jest.fn(),
  deleteTask: jest.fn(),
  listMentionedTasks: jest.fn(),
});

describe('TasksService — привязка тем Telegram', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('подставляет тему Telegram при создании задачи', async () => {
    resolveTaskTypeTopicId.mockResolvedValue(627);
    const repo = createRepo();
    const service = new TasksService(repo as unknown as any);

    await service.create(
      { task_type: ' Доставить ' } as unknown as Partial<TaskDocument>,
    );

    expect(resolveTaskTypeTopicId).toHaveBeenCalledWith('Доставить');
    expect(repo.createTask).toHaveBeenCalledTimes(1);
    const payload = repo.createTask.mock.calls[0][0] as Partial<TaskDocument>;
    expect(payload.telegram_topic_id).toBe(627);
  });

  it('обновляет тему Telegram при смене типа задачи', async () => {
    resolveTaskTypeTopicId.mockResolvedValue(512);
    const repo = createRepo();
    const service = new TasksService(repo as unknown as any);

    await service.update('task', { task_type: 'Купить' }, 101);

    expect(resolveTaskTypeTopicId).toHaveBeenCalledWith('Купить');
    expect(repo.updateTask).toHaveBeenCalledTimes(1);
    const payload = repo.updateTask.mock.calls[0][1] as Partial<TaskDocument>;
    expect(payload.telegram_topic_id).toBe(512);
  });

  it('не устанавливает тему, если тип не задан', async () => {
    resolveTaskTypeTopicId.mockResolvedValue(2048);
    const repo = createRepo();
    const service = new TasksService(repo as unknown as any);

    await service.update('task', { comment: 'Без изменения типа' }, 55);

    expect(resolveTaskTypeTopicId).not.toHaveBeenCalled();
    expect(repo.updateTask).toHaveBeenCalledTimes(1);
    const payload = repo.updateTask.mock.calls[0][1] as Partial<TaskDocument>;
    expect(payload.telegram_topic_id).toBeUndefined();
  });
});
