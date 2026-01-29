// Назначение: проверка сервиса настроек маршрутных планов.
// Основные модули: jest.
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const findMock = jest.fn();

jest.mock('../src/db/models/CollectionItem', () => ({
  CollectionItem: {
    find: (...args: unknown[]) => findMock(...args),
  },
}));

import {
  invalidateRoutePlanSettingsCache,
  resolveRoutePlanTarget,
} from '../src/services/routePlanSettings';

beforeEach(() => {
  findMock.mockReset();
  invalidateRoutePlanSettingsCache();
});

test('возвращает tg-канал из tg_theme_url', async () => {
  findMock.mockReturnValue({
    lean: () =>
      Promise.resolve([
        {
          name: 'default',
          value: 'Маршрутные листы',
          meta: { tg_theme_url: 'https://t.me/c/555/77' },
        },
      ]),
  });
  const target = await resolveRoutePlanTarget();
  expect(target).toEqual({ chatId: '-100555', topicId: 77 });
});

test('возвращает null если tg_theme_url не задан', async () => {
  findMock.mockReturnValue({
    lean: () =>
      Promise.resolve([
        {
          name: 'default',
          value: 'Маршрутные листы',
          meta: {},
        },
      ]),
  });
  const target = await resolveRoutePlanTarget();
  expect(target).toBeNull();
});
