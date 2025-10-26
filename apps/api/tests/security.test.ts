// Назначение: автотесты. Модули: jest, supertest.
import type { Request, Response } from 'express';

process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const request = require('supertest');
const applySecurity = require('../src/api/security').default;
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');

test('CSP работает в режиме report-only', async () => {
  process.env.CSP_REPORT_ONLY = 'true';
  process.env.CSP_REPORT_URI = 'https://csp.example.com/report';
  const app = express();
  applySecurity(app);
  app.get('/', (_req: Request, res: Response) => res.send('ok'));
  const res = await request(app).get('/');
  const ro = res.headers['content-security-policy-report-only'];
  expect(ro).toBeDefined();
  expect(ro).not.toContain('upgrade-insecure-requests');
  expect(ro).toContain('report-uri https://csp.example.com/report');
  expect(res.headers['content-security-policy']).toBeUndefined();
  expect(res.headers['x-content-type-options']).toBe('nosniff');
  expect(res.headers['x-frame-options']).toBe('DENY');
  expect(res.headers['referrer-policy']).toBe('no-referrer');
});

test('CSP включается в строгом режиме', async () => {
  process.env.CSP_REPORT_ONLY = 'false';
  process.env.CSP_REPORT_URI = 'https://csp.example.com/report';
  const app = express();
  applySecurity(app);
  app.get('/', (_req: Request, res: Response) => res.send('ok'));
  const res = await request(app).get('/');
  const csp = res.headers['content-security-policy'] || '';
  expect(csp).toContain('upgrade-insecure-requests');
  expect(csp).toContain('report-uri https://csp.example.com/report');
});

afterAll(() => {
  stopScheduler();
  stopQueue();
  delete process.env.CSP_REPORT_URI;
  delete process.env.CSP_REPORT_ONLY;
});
