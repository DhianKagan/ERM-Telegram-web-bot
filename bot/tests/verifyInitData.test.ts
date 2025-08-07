// Назначение: автотесты. Модули: jest, supertest.
// Тест проверки функции verifyInitData
process.env.BOT_TOKEN = 'x';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';
const crypto = require('crypto');
const verify = require('../src/utils/verifyInitData').default;

test('корректная строка возвращает true', () => {
  const data = { query_id: '1', user: JSON.stringify({ id: 1 }) };
  const str = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update('x').digest();
  const hash = crypto.createHmac('sha256', secret).update(str).digest('hex');
  const initData = `query_id=1&user=%7B%22id%22%3A1%7D&hash=${hash}`;
  expect(verify(initData)).toBe(true);
});

test('неверная подпись возвращает false', () => {
  const initData = 'query_id=1&user=%7B%22id%22%3A1%7D&hash=bad';
  expect(verify(initData)).toBe(false);
});
