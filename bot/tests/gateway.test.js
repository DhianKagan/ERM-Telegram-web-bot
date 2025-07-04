// Тест модуля gateway: проверяем вызов https.request
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.JWT_SECRET = 's'
process.env.APP_URL = 'https://localhost'
process.env.GATEWAY_API_KEY = 'k'
process.env.GATEWAY_SENDER = 'sender'

const https = require('https')
const { EventEmitter } = require('events')
const { stopScheduler } = require('../src/services/scheduler')
const { stopQueue } = require('../src/services/messageQueue')
jest.spyOn(https, 'request').mockImplementation((_o, cb) => {
  const res = new EventEmitter()
  res.statusCode = 200
  cb(res)
  process.nextTick(() => res.emit('end'))
  return { on: jest.fn(), write: jest.fn(), end: jest.fn() }
})

const { sendSms } = require('../src/services/gateway')

test('sendSms triggers https.request', async () => {
  await sendSms('123', 'hi')
  expect(https.request).toHaveBeenCalled()
})

afterAll(() => { stopScheduler(); stopQueue() })
