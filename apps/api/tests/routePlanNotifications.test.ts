// Назначение: проверка выбора Telegram-канала для маршрутных планов.
// Основные модули: jest.
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '123';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const resolveRoutePlanTargetMock = jest.fn();

jest.mock('../src/services/routePlanSettings', () => ({
  resolveRoutePlanTarget: (...args: unknown[]) =>
    resolveRoutePlanTargetMock(...args),
}));

import { resolveRoutePlanSendTarget } from '../src/services/routePlans';

beforeEach(() => {
  resolveRoutePlanTargetMock.mockReset();
});

test('использует настройки маршрутов, если они заданы', async () => {
  resolveRoutePlanTargetMock.mockResolvedValue({
    chatId: '-100777',
    topicId: 42,
  });
  const target = await resolveRoutePlanSendTarget();
  expect(target).toEqual({ chatId: '-100777', topicId: 42 });
});

test('fallback на CHAT_ID при отсутствии настроек', async () => {
  resolveRoutePlanTargetMock.mockResolvedValue(null);
  const target = await resolveRoutePlanSendTarget();
  expect(target).toEqual({ chatId: '123' });
});
