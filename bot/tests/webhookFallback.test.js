// Тест обработки ошибки вебхука и отправки сообщения админу
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.JWT_SECRET = 's'
process.env.APP_URL = 'https://localhost'
process.env.WEBHOOK_URL = 'https://hook'
process.env.NODE_ENV = 'test'

jest.mock('telegraf', () => {
  const mock = {
    telegram: { setWebhook: jest.fn().mockRejectedValue(new Error('fail')) },
    startWebhook: jest.fn(),
    launch: jest.fn().mockResolvedValue(),
    command: jest.fn(),
    start: jest.fn(),
    on: jest.fn(),
    action: jest.fn(),
    stop: jest.fn()
  }
  global.__telegrafMock = mock
  return {
    Telegraf: jest.fn(() => mock),
    Markup: { button: {}, inlineKeyboard: jest.fn(), keyboard: jest.fn() }
  }
})

jest.mock('../src/services/telegramApi', () => ({ call: jest.fn() }))
const telegramApi = require('../src/services/telegramApi')
const { stopScheduler } = require('../src/services/scheduler')

beforeAll(() => {
  require('../src/bot/bot')
})

afterAll(() => { jest.resetModules(); stopScheduler() })

test('после ошибки webhook отправляется сообщение администратору', async () => {
  await new Promise(process.nextTick)
  expect(global.__telegrafMock.launch).toHaveBeenCalled()
  expect(telegramApi.call).toHaveBeenCalledWith('sendMessage', {
    chat_id: '1',
    text: expect.stringContaining('fail')
  })
})
