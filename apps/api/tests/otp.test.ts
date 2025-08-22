// Назначение: автотесты. Модули: jest, supertest.
process.env.BOT_TOKEN = 't';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 's';

jest.mock('../src/services/telegramApi', () => ({ call: jest.fn() }));

const {
  sendCode,
  verifyCode,
  codes,
  attempts,
} = require('../src/services/otp');

beforeEach(() => {
  codes.clear();
  attempts.clear();
});

test('verifyCode блокирует после пяти ошибочных попыток', async () => {
  await sendCode({ telegramId: 42 });
  const real = codes.get('42').code;
  for (let i = 0; i < 5; i++) {
    expect(verifyCode({ telegramId: 42, code: '0' })).toBe(false);
  }
  expect(verifyCode({ telegramId: 42, code: real })).toBe(false);
});
