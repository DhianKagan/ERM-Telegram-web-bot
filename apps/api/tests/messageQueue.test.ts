// Назначение: автотесты. Модули: jest, supertest.
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 's';
process.env.APP_URL = 'https://localhost';

const {
  enqueue,
  queue,
  stopQueue,
  MAX_QUEUE_SIZE,
} = require('../src/services/messageQueue');

test('очередь замедляет отправку при большом числе задач', async () => {
  const start = Date.now();
  const jobs = [];
  for (let i = 0; i < 60; i++) {
    jobs.push(enqueue(() => Promise.resolve()));
  }
  await Promise.all(jobs);
  const duration = Date.now() - start;
  expect(duration).toBeGreaterThanOrEqual(900);
  expect(queue.length).toBe(0);
});

test('enqueue отклоняет переполнение', async () => {
  for (let i = 0; i < MAX_QUEUE_SIZE; i++) {
    enqueue(() => Promise.resolve());
  }
  await expect(enqueue(() => Promise.resolve())).rejects.toThrow(
    'queue overflow',
  );
});

afterAll(() => stopQueue());
