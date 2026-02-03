// Назначение: автотесты. Модули: jest, supertest.
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 's';
process.env.SCHEDULE_CRON = '* * * * *';
process.env.APP_URL = 'https://localhost';

import * as cron from 'node-cron';
import { PROJECT_TIMEZONE } from 'shared';
import { startScheduler, stopScheduler } from '../src/services/scheduler';
import { stopQueue } from '../src/services/messageQueue';

jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({ stop: jest.fn() })),
}));

test('startScheduler вызывает cron.schedule', () => {
  startScheduler();
  expect(cron.schedule).toHaveBeenNthCalledWith(
    1,
    '* * * * *',
    expect.any(Function),
    { timezone: PROJECT_TIMEZONE },
  );
  expect(cron.schedule).toHaveBeenNthCalledWith(
    2,
    '30 2 * * *',
    expect.any(Function),
    { timezone: PROJECT_TIMEZONE },
  );
  stopScheduler();
});

afterAll(() => stopQueue());
