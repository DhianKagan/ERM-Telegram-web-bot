// Назначение: автотесты. Модули: jest, supertest.
// Тест функции hasAccess для разных масок
export {};

process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const {
  hasAccess,
  ACCESS_USER,
  ACCESS_ADMIN,
  ACCESS_MANAGER,
  ACCESS_TASK_DELETE,
} = require('../src/utils/accessMask');

afterAll(() => {
  const { stopScheduler } = require('../src/services/scheduler');
  const { stopQueue } = require('../src/services/messageQueue');
  stopScheduler();
  stopQueue();
});

test('пользователь с комбинированной маской имеет нужные права', () => {
  const mask = ACCESS_USER | ACCESS_MANAGER;
  expect(hasAccess(mask, ACCESS_MANAGER)).toBe(true);
  expect(hasAccess(mask, ACCESS_ADMIN)).toBe(false);
});

test('менеджер и администратор наследуют права пользователя', () => {
  expect(hasAccess(ACCESS_MANAGER, ACCESS_USER)).toBe(true);
  expect(hasAccess(ACCESS_ADMIN, ACCESS_USER)).toBe(true);
});

test('уровень 8 наследует права администратора и менеджера', () => {
  expect(hasAccess(ACCESS_TASK_DELETE, ACCESS_TASK_DELETE)).toBe(true);
  expect(hasAccess(ACCESS_TASK_DELETE, ACCESS_ADMIN)).toBe(true);
  expect(hasAccess(ACCESS_TASK_DELETE, ACCESS_MANAGER)).toBe(true);
});

test('админ без уровня 8 не может удалять задачи', () => {
  const adminMask = ACCESS_ADMIN | ACCESS_MANAGER;
  expect(hasAccess(adminMask, ACCESS_TASK_DELETE)).toBe(false);
});
