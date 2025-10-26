// Назначение: автотесты. Модули: jest, supertest.
export {};

process.env.BOT_TOKEN = 't';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 's';

jest.mock('../src/services/telegramApi', () => ({ call: jest.fn() }));

const {
  sendCode,
  sendManagerCode,
  verifyCode,
  codes,
  attempts,
} = require('../src/services/otp');
const { call } = require('../src/services/telegramApi');

beforeEach(() => {
  codes.clear();
  attempts.clear();
  call.mockClear();
});

test('verifyCode блокирует после пяти ошибочных попыток', async () => {
  await sendCode({ telegramId: 42 });
  const real = codes.get('42').code;
  for (let i = 0; i < 5; i++) {
    expect(verifyCode({ telegramId: 42, code: '0' })).toBe(false);
  }
  expect(verifyCode({ telegramId: 42, code: real })).toBe(false);
});

test('sendManagerCode отправляет корректный текст для менеджера', async () => {
  await sendManagerCode({ telegramId: 7 });
  const stored = codes.get('7');
  expect(stored).toBeDefined();
  expect(call).toHaveBeenCalledWith(
    'sendMessage',
    expect.objectContaining({
      chat_id: 7,
      text: `Код входа для менеджера: ${stored.code}`,
    }),
  );
});
