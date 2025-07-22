process.env.NODE_ENV = 'test'
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.JWT_SECRET = 'secret'
process.env.APP_URL = 'https://localhost'

const express = require('express')
const cookieParser = require('cookie-parser')
const session = require('express-session')
const lusca = require('lusca')
const request = require('supertest')

const { errorHandler } = require('../src/api/middleware')
const { stopScheduler } = require('../src/services/scheduler')
const { stopQueue } = require('../src/services/messageQueue')

let app

beforeAll(() => {
  app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use(
    session({
      secret: 'test',
      resave: false,
      saveUninitialized: true,
      cookie: { secure: process.env.NODE_ENV !== 'test' }
    })
  )
  app.post('/secure', lusca.csrf({ angular: true }), (_req, res) => {
    res.json({ ok: true })
  })
  app.use(errorHandler)
})

afterAll(() => { stopScheduler(); stopQueue() })

test('ошибка CSRF возвращает 403', async () => {
  const res = await request(app).post('/secure')
  expect(res.status).toBe(403)
  expect(res.body.error).toMatch(/CSRF token/)
})
