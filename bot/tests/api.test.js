// Интеграционные тесты HTTP API: проверяем /health и /api/tasks.
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.JWT_SECRET = 'secret'
process.env.APP_URL = 'https://localhost'

const request = require('supertest')
const express = require('express')
jest.mock('../src/services/service', () => ({ listAllTasks: jest.fn() }))
const services = require('../src/services/service')
const { stopScheduler } = require('../src/services/scheduler')
jest.unmock('jsonwebtoken')

let app
beforeAll(async () => {
  services.listAllTasks.mockResolvedValue([{ id: 1 }])
  const { verifyToken, asyncHandler, errorHandler } = require('../src/api/middleware')
  const { generateToken } = require('../src/auth/auth')
  app = express()
  app.use(express.json())
  app.get('/health', (_req, res) => res.json({ status: 'ok' }))
  const token = generateToken({ id: 1, username: 'test', isAdmin: true })
  app.get('/api/tasks', verifyToken, asyncHandler(async (_req, res) => {
    res.json(await services.listAllTasks())
  }))
  app.use(errorHandler)
  app.locals.token = token
})

afterAll(() => { jest.clearAllMocks(); stopScheduler() })

test('GET /health', async () => {
  const res = await request(app).get('/health')
  expect(res.body.status).toBe('ok')
})

test('GET /api/tasks отдает список задач', async () => {
  const token = app.locals.token
  const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`)
  expect(res.status).toBe(200)
  expect(Array.isArray(res.body)).toBe(true)
})
