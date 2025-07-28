// Тест профиля через токен Telegram
process.env.JWT_SECRET = 'test'
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.APP_URL = 'https://localhost'

const express = require('express')
const request = require('supertest')
const { stopScheduler } = require('../src/services/scheduler')
const { stopQueue } = require('../src/services/messageQueue')

  jest.mock('../src/db/queries', () => ({
    getUser: jest.fn(async () => ({ telegram_id: 1, username: 'test' })),
    updateUser: jest.fn(async (_id, d) => ({ telegram_id: 1, username: 'test', ...d }))
  }))

const ctrl = require('../src/auth/auth.controller.ts')


let app
beforeAll(() => {
  app = express()
  app.use(express.json())
  app.get('/api/v1/auth/profile', ctrl.profile)
})

test('получаем профиль', async () => {
  const req = { user: { id: 1 } }
  const resMock = { json: jest.fn(), sendStatus: jest.fn() }
  await ctrl.profile(req, resMock)
  expect(resMock.json).toHaveBeenCalledWith({
    telegram_id: 1,
    username: '1',
    telegram_username: 'test'
  })
})

test('обновляем профиль', async () => {
  const req = { user: { id: 1 }, body: { name: 'N' } }
  const resMock = { json: jest.fn(), sendStatus: jest.fn() }
  await ctrl.updateProfile(req, resMock)
  expect(resMock.json).toHaveBeenCalledWith({
    telegram_id: 1,
    username: '1',
    telegram_username: 'test',
    name: 'N',
    phone: undefined,
    mobNumber: undefined
  })
})

afterAll(() => { stopScheduler(); stopQueue() })
