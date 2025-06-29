// Интеграционные тесты HTTP API: проверяем /health, /auth/login и /api/tasks.
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.JWT_SECRET = 'secret'
process.env.APP_URL = 'https://localhost'
process.env.ADMIN_EMAIL = 'admin@test.com'
process.env.ADMIN_PASSWORD = 'pass'

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
  app.post('/auth/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body
    if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    res.json({ token: generateToken({ id: 0, username: email, isAdmin: true }), role: 'admin', name: 'Администратор' })
  }))
  app.get('/api/tasks', verifyToken, asyncHandler(async (_req, res) => {
    res.json(await services.listAllTasks())
  }))
  app.use(errorHandler)
})

afterAll(() => { jest.clearAllMocks(); stopScheduler() })

test('GET /health', async () => {
  const res = await request(app).get('/health')
  expect(res.body.status).toBe('ok')
})

test('POST /auth/login возвращает токен', async () => {
  const res = await request(app).post('/auth/login').send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
  expect(res.body.token).toBeDefined()
})

test('GET /api/tasks отдает список задач', async () => {
  const { body } = await request(app).post('/auth/login').send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
  const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${body.token}`)
  expect(res.status).toBe(200)
  expect(Array.isArray(res.body)).toBe(true)
})
