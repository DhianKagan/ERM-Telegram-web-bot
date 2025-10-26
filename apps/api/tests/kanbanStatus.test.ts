// Назначение: автотесты. Модули: jest, supertest.
// Интеграционный тест обновления статуса задачи через канбан
import type { NextFunction, Request, Response } from 'express';

process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 's';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const request = require('supertest');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

jest.mock('../src/services/service', () => ({
  updateTaskStatus: jest.fn(),
  writeLog: jest.fn(),
}));

jest.mock('../src/api/middleware', () => ({
  verifyToken: (_req: unknown, _res: unknown, next: NextFunction) => next(),
  asyncHandler: <T>(fn: T) => fn,
  errorHandler: (err: Error, _req: Request, res: Response, _next: NextFunction) =>
    res.status(500).json({ error: err.message }),
}));

const { updateTaskStatus, writeLog } = require('../src/services/service');
const { asyncHandler } = require('../src/api/middleware');
const { body, validationResult } = require('express-validator');

const app = express();
app.use(express.json());
app.patch(
  '/api/v1/tasks/:id/status',
  [body('status').isIn(['Новая', 'В работе', 'Выполнена', 'Отменена'])],
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    return next();
  },
  asyncHandler(async (req: Request, res: Response) => {
    await updateTaskStatus(req.params.id, req.body.status, 0);
    await writeLog(`Статус задачи ${req.params.id} -> ${req.body.status}`);
    res.json({ status: 'ok' });
  }),
);

const id = '507f191e810c19729de860ea';

test('статус задачи меняется на В работе', async () => {
  const res = await request(app)
    .patch(`/api/v1/tasks/${id}/status`)
    .send({ status: 'В работе' });
  expect(res.body.status).toBe('ok');
  expect(updateTaskStatus).toHaveBeenCalledWith(id, 'В работе', 0);
});

afterAll(() => {
  stopScheduler();
  stopQueue();
});
