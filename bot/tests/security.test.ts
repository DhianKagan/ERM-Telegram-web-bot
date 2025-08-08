// Назначение: автотесты. Модули: jest, supertest.
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.JWT_SECRET = 's'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.APP_URL = 'https://localhost'

const express = require('express')
const request = require('supertest')
const applySecurity = require('../src/security').default
const { stopScheduler } = require('../src/services/scheduler')
const { stopQueue } = require('../src/services/messageQueue')

test('CSP работает в режиме report-only', async () => {
  process.env.CSP_REPORT_ONLY = 'true'
  const app = express()
  applySecurity(app)
  app.get('/', (_req, res) => res.send('ok'))
  const res = await request(app).get('/')
  expect(res.headers['content-security-policy-report-only']).toBeDefined()
  expect(res.headers['content-security-policy']).toBeUndefined()
  expect(res.headers['x-content-type-options']).toBe('nosniff')
  expect(res.headers['x-frame-options']).toBe('DENY')
  expect(res.headers['referrer-policy']).toBe('no-referrer')
})

test('CSP включается в строгом режиме', async () => {
  process.env.CSP_REPORT_ONLY = 'false'
  const app = express()
  applySecurity(app)
  app.get('/', (_req, res) => res.send('ok'))
  const res = await request(app).get('/')
  expect(res.headers['content-security-policy']).toBeDefined()
})

afterAll(() => {
  stopScheduler()
  stopQueue()
})
