// Тесты валидации аргументов команд бота
const handlers = {}

jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    command: (name, fn) => { handlers[name] = fn },
    start: jest.fn(),
    on: jest.fn(),
    launch: jest.fn().mockResolvedValue(),
    telegram: {
      getChatMember: jest.fn().mockResolvedValue({ status: 'member' }),
      getChatAdministrators: jest.fn().mockResolvedValue([{ user: { id: 1 } }])
    }
  }))
}))

jest.mock('../src/auth/auth', () => ({
  verifyAdmin: jest.fn().mockResolvedValue(true),
  generateToken: jest.fn().mockReturnValue('t')
}))

jest.mock('../src/services/service', () => ({
  assignTask: jest.fn(),
  listUsers: jest.fn(),
  createUser: jest.fn(),
  listUserTasks: jest.fn().mockResolvedValue([]),
  createTask: jest.fn(),
  listAllTasks: jest.fn(),
  updateTaskStatus: jest.fn(),
  getUser: jest.fn(),
  createGroup: jest.fn(),
  listGroups: jest.fn(),
  createRole: jest.fn(),
  listRoles: jest.fn(),
  writeLog: jest.fn(),
  listLogs: jest.fn()
}))

jest.mock('../src/services/r2', () => ({
  uploadFile: jest.fn(),
  client: {}
}))

jest.mock('../src/db/model', () => ({}))

jest.mock('../src/services/telegramApi', () => ({
  call: jest.fn()
}))

const messages = require('../src/messages')

beforeAll(() => {
  process.env.BOT_TOKEN = 't'
  process.env.CHAT_ID = '1'
  process.env.JWT_SECRET = 's'
  process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
  process.env.APP_URL = 'http://localhost'
  require('../src/bot/bot')
})

afterAll(() => jest.resetModules())

test('/assign_task без аргументов', async () => {
  const ctx = { message: { text: '/assign_task' }, from: { id: 1 }, reply: jest.fn() }
  await handlers.assign_task(ctx)
  expect(ctx.reply).toHaveBeenCalledWith(messages.assignParamsRequired)
})

test('/upload_file без аргументов', async () => {
  const ctx = { message: { text: '/upload_file' }, from: { id: 1 }, reply: jest.fn() }
  await handlers.upload_file(ctx)
  expect(ctx.reply).toHaveBeenCalledWith(messages.uploadParamsRequired)
})

test('/edit_last без аргументов', async () => {
  const ctx = { message: { text: '/edit_last' }, chat: { id: 1 }, reply: jest.fn() }
  await handlers.edit_last(ctx)
  expect(ctx.reply).toHaveBeenCalledWith(messages.messageIdRequired)
})
