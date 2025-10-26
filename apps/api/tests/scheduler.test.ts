// Назначение: автотесты. Модули: jest, supertest.
export {};

process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 's';
process.env.SCHEDULE_CRON = '* * * * *';
process.env.APP_URL = 'https://localhost';

jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({ stop: jest.fn() })),
}));

const cron = require('node-cron');
const { startScheduler, stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

test('startScheduler вызывает cron.schedule', () => {
  startScheduler();
  expect(cron.schedule).toHaveBeenCalledWith('* * * * *', expect.any(Function));
  stopScheduler();
});

afterAll(() => stopQueue());
