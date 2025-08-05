// Назначение: автотесты. Модули: jest, supertest.
// Проверка BOT_API_URL для telegramApi
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.JWT_SECRET = 's'
process.env.APP_URL = 'https://localhost'
process.env.BOT_API_URL = 'http://localhost:8081'

const telegramApi = require('../src/services/telegramApi')
const { stopScheduler } = require('../src/services/scheduler')
const { stopQueue } = require('../src/services/messageQueue')

test('telegramApi использует BOT_API_URL', async () => {
  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ ok: true, result: 1 }) })
  await telegramApi.call('getMe')
  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:8081/bott/getMe',
    expect.objectContaining({ method: 'POST' })
  )
})

afterAll(() => { stopScheduler(); stopQueue() })
