// Назначение: автотесты. Модули: jest, supertest.
// Тесты middleware pinoLogger
const express = require('express');
const request = require('supertest');

const info = jest.fn();
const mockChild = {
  info,
  warn: jest.fn(),
  error: jest.fn(),
  child: () => mockChild,
};
const mockLogger = { child: jest.fn(() => mockChild) };

jest.mock('../src/services/wgLogEngine', () => ({
  logger: mockLogger,
}));

jest.mock('pino-http', () => (options) => (req, _res, next) => {
  const id = options.genReqId(req);
  const props = options.customProps(req);
  options.logger.info({ req: { id }, ...props });
  next();
});

beforeEach(() => {
  jest.resetModules();
  info.mockClear();
  mockLogger.child.mockClear();
});

test('pinoLogger пишет ip, ua и reqId из traceparent', async () => {
  process.env.SUPPRESS_LOGS = '0';
  const pinoLogger = require('../src/middleware/pinoLogger').default;
  const app = express();
  app.use(pinoLogger);
  app.get('/', (_req, res) => res.send('ok'));
  await request(app)
    .get('/')
    .set(
      'traceparent',
      '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-00',
    )
    .set('User-Agent', 'jest')
    .expect(200);
  expect(mockLogger.child).toHaveBeenCalledWith({ component: 'http' });
  const log = info.mock.calls[0][0];
  expect(log.ip).toBe('::ffff:127.0.0.1');
  expect(log.ua).toBe('jest');
  expect(log.method).toBe('GET');
  expect(log.path).toBe('/');
  expect(log.req.id).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb');
});
