/**
 * Назначение файла: проверяет обработку расстояния в устаревшем сервисе задач.
 * Основные модули: services/tasks, services/route.
 */

process.env.BOT_TOKEN ||= 'test-bot-token';
process.env.CHAT_ID ||= '0';
process.env.JWT_SECRET ||= 'test-secret';
process.env.APP_URL ||= 'https://example.com';
process.env.MONGO_DATABASE_URL ||=
  'mongodb://admin:admin@localhost:27017/ermdb?authSource=admin';
process.env.ROUTING_URL ||= 'https://localhost:8000/route';

jest.mock('../apps/api/src/db/queries', () => ({
  createTask: jest.fn(async (data) => data),
  getTasks: jest.fn(),
  getTask: jest.fn(),
  updateTask: jest.fn(),
  addTime: jest.fn(),
  bulkUpdate: jest.fn(),
  summary: jest.fn(),
  deleteTask: jest.fn(),
  listMentionedTasks: jest.fn(),
}));

jest.mock('../apps/api/src/services/taskLinks', () => ({
  ensureTaskLinksShort: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../apps/api/src/services/taskTypeSettings', () => ({
  resolveTaskTypeTopicId: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../apps/api/src/geo/osrm', () => ({
  getOsrmDistance: jest.fn(),
}));

import { generateRouteLink } from 'shared';
import { create } from '../apps/api/src/services/tasks';

const { createTask } = jest.requireMock('../apps/api/src/db/queries');
const { getOsrmDistance } = jest.requireMock('../apps/api/src/geo/osrm');

describe('legacy tasks service — расчёт маршрута', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('не устанавливает расстояние маршрута, если сервис его не вернул', async () => {
    const start = { lat: 50.45, lng: 30.523 } as const;
    const finish = { lat: 49.84, lng: 24.03 } as const;
    getOsrmDistance.mockResolvedValue(null);

    await create({ startCoordinates: start, finishCoordinates: finish });

    expect(createTask).toHaveBeenCalledTimes(1);
    const payload = createTask.mock.calls[0][0];
    expect(payload.google_route_url).toBe(generateRouteLink(start, finish));
    expect(payload.route_distance_km).toBeNull();
  });
});
