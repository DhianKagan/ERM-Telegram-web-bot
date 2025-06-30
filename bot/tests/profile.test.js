// Тест профиля через токен Telegram
process.env.JWT_SECRET = 'test'
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.APP_URL = 'https://localhost'

const express = require('express')
const request = require('supertest')
const { stopScheduler } = require('../src/services/scheduler')

jest.mock('../src/db/queries', () => ({
  getUser: jest.fn(async () => ({ telegram_id: 1, username: 'test' }))
}))

const ctrl = require('../src/controllers/authUser')


let app
beforeAll(() => {
  app = express()
  app.get('/api/auth/profile', ctrl.profile)
})

test('получаем профиль', async () => {
  const req = { user: { id: 1 } }
  const resMock = { json: jest.fn(), sendStatus: jest.fn() }
  await ctrl.profile(req, resMock)
  expect(resMock.json).toHaveBeenCalledWith({ telegram_id: 1, username: 'test' })
})

afterAll(() => stopScheduler())
