// Назначение: автотесты. Модули: jest, supertest.
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 's';
process.env.APP_URL = 'https://localhost';

jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    telegram: {
      getChatMember: jest.fn().mockResolvedValue({ status: 'member' }),
    },
  })),
}));

const {
  getMemberStatus,
  getTelegramId,
} = require('../src/services/userInfoService');

test('getMemberStatus возвращает статус участника', async () => {
  const status = await getMemberStatus(1);
  expect(status).toBe('member');
});

test('getTelegramId извлекает id из ctx', () => {
  const id = getTelegramId({ from: { id: 2 } });
  expect(id).toBe(2);
});
