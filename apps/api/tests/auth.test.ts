// Назначение: автотесты. Модули: jest, supertest.
// Тесты модуля auth: генерация JWT и проверка кода
jest.mock('telegraf', () => ({
  Telegraf: jest.fn(),
}));
jest.mock('jsonwebtoken');
jest.mock('../src/services/telegramApi', () => ({ call: jest.fn() }));
jest.mock('../src/services/userInfoService', () => ({
  getMemberStatus: jest.fn(async () => 'member'),
}));
jest.mock('../src/db/queries', () => ({
  getUser: jest.fn(async (id) => {
    if (String(id) === '99') return { roleId: '686591126cc86a6bd16c18af' };
    if (String(id) === '5') return { roleId: '686633fdf6896f1ad3fa063e' };
    return null;
  }),
  createUser: jest.fn(async () => ({ username: 'u' })),
  updateUser: jest.fn(async (_id, _roleId, _data) => ({
    roleId: '686591126cc86a6bd16c18af',
    role: 'admin',
  })),
}));
jest.mock('../src/services/service', () => ({ writeLog: jest.fn() }));
jest.useFakeTimers().setSystemTime(0);
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 'test';
process.env.APP_URL = 'https://localhost';
const { generateToken } = require('../src/auth/auth');
const jwt = require('jsonwebtoken');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');
const authCtrl = require('../src/auth/auth.controller.ts');
const queries = require('../src/db/queries');
const { writeLog } = require('../src/services/service');

afterEach(() => {
  authCtrl.codes.clear();
  jest.setSystemTime(0);
});

test('generateToken returns valid jwt', () => {
  const token = generateToken({
    id: 5,
    username: 'a',
    role: 'admin',
    access: 2,
  });
  const data = jwt.decode(token);
  expect(data.id).toBe(5);
});

test('sendCode сохраняет код с таймстампом', async () => {
  const req = { body: { telegramId: 5 } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await authCtrl.sendCode(req, res);
  const entry = authCtrl.codes.get('5');
  expect(typeof entry.ts).toBe('number');
  expect(entry.code).toHaveLength(6);
});

test('sendCode для админа использует adminCodes', async () => {
  const req = { body: { telegramId: 99 } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await authCtrl.sendCode(req, res);
  const entry = authCtrl.adminCodes.get('99');
  expect(entry).toBeDefined();
});

test('verifyCode отклоняет просроченный код', async () => {
  const req = { body: { telegramId: 111 } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await authCtrl.sendCode(req, res);
  const code = authCtrl.codes.get('111').code;
  jest.setSystemTime(6 * 60 * 1000);
  const res2 = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await authCtrl.verifyCode({ body: { telegramId: 111, code } }, res2);
  expect(res2.status).toHaveBeenCalledWith(400);
  expect(authCtrl.codes.has('111')).toBe(false);
});

test('verifyCode возвращает токен и устанавливает cookie', async () => {
  const req = { body: { telegramId: 7 } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await authCtrl.sendCode(req, res);
  const code = authCtrl.codes.get('7').code;
  const res2 = {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
    cookie: jest.fn(),
  };
  await authCtrl.verifyCode(
    { body: { telegramId: 7, code, username: 'u' } },
    res2,
  );
  expect(res2.json).toHaveBeenCalledWith({ token: expect.any(String) });
  expect(res2.cookie).toHaveBeenCalled();
});

test('admin code обновляет роль пользователя', async () => {
  authCtrl.adminCodes.set('5', { code: '1234', ts: Date.now() });
  const res = {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
    cookie: jest.fn(),
  };
  await authCtrl.verifyCode(
    { body: { telegramId: 5, code: '1234', username: 'u' } },
    res,
  );
  expect(res.json).toHaveBeenCalledWith({ token: expect.any(String) });
  expect(res.cookie).toHaveBeenCalled();
  expect(queries.updateUser).toHaveBeenCalled();
});

test('успешный вход записывается в лог', async () => {
  const req = { body: { telegramId: 9 } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await authCtrl.sendCode(req, res);
  const code = authCtrl.codes.get('9').code;
  const res2 = {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
    cookie: jest.fn(),
  };
  await authCtrl.verifyCode(
    { body: { telegramId: 9, code, username: 'u' } },
    res2,
  );
  expect(writeLog).toHaveBeenCalledWith('Вход пользователя 9/u');
});

test('clean удаляет старые записи при новом вызове', async () => {
  const req1 = { body: { telegramId: 1 } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await authCtrl.sendCode(req1, res);
  jest.setSystemTime(6 * 60 * 1000);
  const req2 = { body: { telegramId: 2 } };
  await authCtrl.sendCode(req2, res);
  expect(authCtrl.codes.size).toBe(1);
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
