// Назначение: автотесты. Модули: jest, supertest.
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.JWT_SECRET = 's'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.APP_URL = 'https://localhost'

const express = require('express')
const request = require('supertest')
const helmet = require('helmet')
const { stopScheduler } = require('../src/services/scheduler')
const { stopQueue } = require('../src/services/messageQueue')

test('helmet добавляет security headers', async () => {
  const app = express()
  app.use(helmet())
  app.get('/', (_req, res) => res.send('ok'))
  const res = await request(app).get('/')
  expect(res.headers['x-dns-prefetch-control']).toBe('off')
})

afterAll(() => { stopScheduler(); stopQueue() })
