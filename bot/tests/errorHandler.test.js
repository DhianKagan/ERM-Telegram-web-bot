// Тест обработчика ошибок API. Проверяем ответ на request.aborted
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.JWT_SECRET = 'secret'
process.env.APP_URL = 'https://localhost'

const express = require('express')
const request = require('supertest')
const { errorHandler } = require('../src/api/middleware')
const { stopScheduler } = require('../src/services/scheduler')

let app
beforeAll(() => {
  app = express()
  app.get('/aborted', (_req, _res, next) => {
    const err = new Error('aborted')
    err.type = 'request.aborted'
    next(err)
  })
  app.use(errorHandler)
})

afterAll(() => stopScheduler())

test('errorHandler возвращает 400 для request.aborted', async () => {
  const res = await request(app).get('/aborted')
  expect(res.status).toBe(400)
  expect(res.body.error).toBe('request aborted')
})
