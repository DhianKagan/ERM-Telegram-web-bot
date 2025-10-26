// Назначение: автотесты. Модули: jest, supertest.
// Тест проверки функции verifyInitData
export {};

process.env.BOT_TOKEN = 'x';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';
const crypto = require('crypto');
const verify = require('../src/utils/verifyInitData').default;

type InitDataKeys = 'query_id' | 'user' | 'auth_date' | 'signature';

function buildInitData(ts: number): string {
  const data: Record<InitDataKeys, string> = {
    query_id: '1',
    user: JSON.stringify({ id: 1, first_name: 'a' }),
    auth_date: String(ts),
    signature: 'sig',
  };
  const keys = Object.keys(data) as InitDataKeys[];
  const str = keys
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update('x').digest();
  const hash = crypto.createHmac('sha256', secret).update(str).digest('hex');
  return `query_id=1&user=%7B%22id%22%3A1%2C%22first_name%22%3A%22a%22%7D&auth_date=${ts}&hash=${hash}&signature=sig`;
}

test('корректная строка возвращает объект', () => {
  const now = Math.floor(Date.now() / 1000);
  const initData = buildInitData(now);
  const data = verify(initData);
  expect(data.user?.id).toBe(1);
});

test('неверная подпись вызывает ошибку', () => {
  const now = Math.floor(Date.now() / 1000);
  const initData = `query_id=1&user=%7B%22id%22%3A1%2C%22first_name%22%3A%22a%22%7D&auth_date=${now}&hash=bad&signature=sig`;
  expect(() => verify(initData)).toThrow();
});

test('просроченный auth_date вызывает ошибку', () => {
  const old = Math.floor(Date.now() / 1000) - 600;
  const initData = buildInitData(old);
  expect(() => verify(initData)).toThrow();
});
