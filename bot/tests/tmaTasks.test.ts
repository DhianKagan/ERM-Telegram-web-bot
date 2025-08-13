// Назначение: автотесты. Модули: jest, supertest, express-rate-limit.
// Тесты TMA-эндпоинтов задач
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const request = require('supertest');
const createRateLimiter = require('../src/utils/rateLimiter').default;
const tmaTasksRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  name: 'tma-tasks',
});

jest.mock('../src/utils/verifyInitData', () =>
  jest.fn(() => ({ user: { id: 123, username: 'u' } })),
);

jest.mock('../src/services/service', () => ({
  listMentionedTasks: jest.fn(async () => [
    { _id: '1', assignees: [123], status: 'Новая' },
  ]),
  getTask: jest.fn(async () => ({
    _id: '1',
    assignees: [123],
    status: 'Новая',
  })),
  updateTaskStatus: jest.fn(async () => {}),
  writeLog: jest.fn(async () => {}),
}));

const tmaAuthGuard = require('../src/auth/tmaAuth.guard').default;
const { asyncHandler } = require('../src/api/middleware');
const {
  listMentionedTasks,
  getTask,
  updateTaskStatus,
} = require('../src/services/service');

const app = express();
app.use(express.json());

app.get(
  '/api/tma/tasks',
  tmaTasksRateLimiter,
  tmaAuthGuard,
  asyncHandler(async (_req, res) => {
    const user = res.locals.initData.user;
    const tasks = await listMentionedTasks(user.id);
    res.json(tasks);
  }),
);

app.patch(
  '/api/tma/tasks/:id/status',
  tmaTasksRateLimiter,
  tmaAuthGuard,
  asyncHandler(async (req, res) => {
    const user = res.locals.initData.user;
    const task = await getTask(req.params.id);
    const ids = [
      task.assigned_user_id,
      task.controller_user_id,
      ...(task.controllers || []),
      ...(task.assignees || []),
      task.created_by,
    ].map((id) => Number(id));
    if (!ids.includes(Number(user.id))) {
      return res.status(403).json({ error: 'forbidden' });
    }
    await updateTaskStatus(req.params.id, req.body.status);
    res.json({ status: 'ok' });
  }),
);

const initData =
  'user=' + encodeURIComponent(JSON.stringify({ id: 123, username: 'u' }));

test('возвращает задачи пользователя', async () => {
  const res = await request(app)
    .get('/api/tma/tasks')
    .set('Authorization', `tma ${initData}`);
  expect(res.body).toHaveLength(1);
  expect(listMentionedTasks).toHaveBeenCalledWith(123);
});

test('обновляет статус задачи', async () => {
  const res = await request(app)
    .patch('/api/tma/tasks/1/status')
    .set('Authorization', `tma ${initData}`)
    .send({ status: 'В работе' });
  expect(res.body.status).toBe('ok');
  expect(updateTaskStatus).toHaveBeenCalledWith('1', 'В работе');
});
