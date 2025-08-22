// Назначение: автотесты. Модули: jest, supertest.
// Тестирование модели MongoDB. Используется Mongoose модель Task.
process.env.NODE_ENV = 'test';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.APP_URL = 'https://localhost';
const { Task } = require('../src/db/model');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

test('schema has task_description', () => {
  const desc = Task.schema.paths.task_description;
  expect(desc).toBeDefined();
});

test('schema has slug field', () => {
  const slug = Task.schema.paths.slug;
  expect(slug).toBeDefined();
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
