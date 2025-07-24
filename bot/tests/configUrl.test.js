// Тест проверки APP_URL
process.env.NODE_ENV = 'test'
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.JWT_SECRET = 's'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.APP_URL = 'https://localhost'

const { stopScheduler } = require('../src/services/scheduler')
const { stopQueue } = require('../src/services/messageQueue')

test('config бросает ошибку если APP_URL не https', () => {
  process.env.APP_URL = 'http://localhost'
  jest.resetModules()
  expect(() => require('../src/config')).toThrow('APP_URL должен начинаться с https://')
})

afterAll(() => { stopScheduler(); stopQueue() })
