/**
 * Назначение файла: проверяет применение темы Telegram для типов задач.
 * Основные модули: TasksService, resolveTaskTypeTopicId.
 */
import type { TaskDocument } from '../apps/api/src/db/model';
import { generateRouteLink } from 'shared';

jest.mock('../apps/api/src/config', () => ({
  __esModule: true,
  botToken: 'test-bot-token',
  botApiUrl: undefined,
  getChatId: () => '0',
  chatId: '0',
  jwtSecret: 'test-secret',
  mongoUrl: 'mongodb://admin:admin@localhost:27017/ermdb?authSource=admin',
  appUrl: 'https://example.com',
  port: 3000,
  locale: 'ru',
  routingUrl: 'https://localhost:8000/route',
  cookieDomain: undefined,
  default: {
    botToken: 'test-bot-token',
    botApiUrl: undefined,
    get chatId() {
      return '0';
    },
    jwtSecret: 'test-secret',
    mongoUrl: 'mongodb://admin:admin@localhost:27017/ermdb?authSource=admin',
    appUrl: 'https://example.com',
    port: 3000,
    locale: 'ru',
    routingUrl: 'https://localhost:8000/route',
    cookieDomain: undefined,
  },
}));

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

jest.mock('../apps/api/src/db/models/fleet', () => ({
  FleetVehicle: {
    findById: jest.fn(),
  },
}));

const { resolveTaskTypeTopicId } =
  jest.requireMock('../apps/api/src/services/taskTypeSettings');
const { getRouteDistance } = jest.requireMock('../apps/api/src/services/route');
const { FleetVehicle } = jest.requireMock('../apps/api/src/db/models/fleet');

type TasksServiceCtor = typeof import('../apps/api/src/tasks/tasks.service').default;
let TasksService: TasksServiceCtor;

beforeAll(async () => {
  ({ default: TasksService } = await import('../apps/api/src/tasks/tasks.service'));
});

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
    (FleetVehicle.findById as jest.Mock).mockReset();
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

  it('добавляет дистанцию и ссылку маршрута при наличии координат', async () => {
    getRouteDistance.mockResolvedValue({ distance: 12345, waypoints: [] });
    const repo = createRepo();
    const service = new TasksService(repo as unknown as any);
    const start = { lat: 50.45, lng: 30.523 };
    const finish = { lat: 49.84, lng: 24.03 };

    await service.update(
      'task',
      { startCoordinates: start, finishCoordinates: finish },
      77,
    );

    expect(getRouteDistance).toHaveBeenCalledWith(start, finish);
    const payload = repo.updateTask.mock.calls[0][1] as Partial<TaskDocument>;
    expect(payload.google_route_url).toBe(generateRouteLink(start, finish));
    expect(payload.route_distance_km).toBe(12.3);
  });
});

describe('TasksService — водитель по умолчанию автопарка', () => {
  const mockVehicleQuery = (result: unknown) => {
    const exec = jest.fn().mockResolvedValue(result);
    const lean = jest.fn().mockReturnValue({ exec });
    const select = jest.fn().mockReturnValue({ lean });
    (FleetVehicle.findById as jest.Mock).mockReturnValue({ select });
    return { exec, lean, select };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (FleetVehicle.findById as jest.Mock).mockReset();
  });

  it('подставляет водителя при создании задачи, если указан транспорт', async () => {
    mockVehicleQuery({ defaultDriverId: 412 });
    const repo = createRepo();
    const service = new TasksService(repo as unknown as any);

    await service.create(
      { transport_vehicle_id: '64f0c7a9f1b2c3d4e5f67890' } as unknown as Partial<TaskDocument>,
    );

    expect(FleetVehicle.findById).toHaveBeenCalledWith('64f0c7a9f1b2c3d4e5f67890');
    const payload = repo.createTask.mock.calls[0][0] as Partial<TaskDocument>;
    expect(payload.transport_driver_id).toBe(412);
  });

  it('не запрашивает транспорт, если водитель уже указан', async () => {
    const repo = createRepo();
    const service = new TasksService(repo as unknown as any);

    await service.create(
      {
        transport_vehicle_id: '64f0c7a9f1b2c3d4e5f67890',
        transport_driver_id: 99,
      } as unknown as Partial<TaskDocument>,
    );

    expect(FleetVehicle.findById).not.toHaveBeenCalled();
    const payload = repo.createTask.mock.calls[0][0] as Partial<TaskDocument>;
    expect(payload.transport_driver_id).toBe(99);
  });

  it('подставляет водителя при обновлении задачи', async () => {
    mockVehicleQuery({ defaultDriverId: 725 });
    const repo = createRepo();
    const service = new TasksService(repo as unknown as any);

    await service.update(
      'task',
      { transport_vehicle_id: '64f0c7a9f1b2c3d4e5f67890', transport_driver_id: '' } as unknown as Partial<TaskDocument>,
      101,
    );

    expect(FleetVehicle.findById).toHaveBeenCalledWith('64f0c7a9f1b2c3d4e5f67890');
    const payload = repo.updateTask.mock.calls[0][1] as Partial<TaskDocument>;
    expect(payload.transport_driver_id).toBe(725);
  });
});
