// Назначение: автотесты. Модули: jest, supertest.
// Тесты middleware pinoLogger
import type { NextFunction, Request, Response } from 'express';

const express = require('express');
const request = require('supertest');

const info = jest.fn();
const mockLogger = { info, error: jest.fn(), child: () => mockLogger };
jest.mock('pino', () => () => mockLogger);
jest.mock('pino-http', () => (o: { genReqId(req: Request): string; customProps(req: Request): Record<string, unknown> }) => (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const id = o.genReqId(req);
  const props = o.customProps(req);
  mockLogger.info({ req: { id }, ...props });
  next();
});

const pinoLogger = require('../src/middleware/pinoLogger').default;

test('pinoLogger пишет ip, ua и reqId из traceparent', async () => {
  const app = express();
  app.use(pinoLogger);
  app.get('/', (_req: Request, res: Response) => res.send('ok'));
  await request(app)
    .get('/')
    .set(
      'traceparent',
      '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-00',
    )
    .set('User-Agent', 'jest')
    .expect(200);
  const log = info.mock.calls[0][0];
  expect(log.ip).toBe('::ffff:127.0.0.1');
  expect(log.ua).toBe('jest');
  expect(log.req.id).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb');
});
