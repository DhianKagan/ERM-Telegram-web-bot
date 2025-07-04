// Тесты валидации аргументов команд бота
const handlers = {}
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.JWT_SECRET = 's'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.APP_URL = 'https://localhost'

jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    command: (name, fn) => { handlers[name] = fn },
    hears: (name, fn) => { handlers[name] = fn },
    start: jest.fn(),
    on: (event, fn) => { handlers[event] = fn },
    action: (name, fn) => { handlers[name] = fn },
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
  searchTasks: jest.fn(),
  listAllTasks: jest.fn(),
  updateTaskStatus: jest.fn(),
  getUser: jest.fn(),
  createGroup: jest.fn(),
  listGroups: jest.fn(),
  createRole: jest.fn(),
  listRoles: jest.fn(),
  writeLog: jest.fn(),
  listLogs: jest.fn(),
  addAttachment: jest.fn()
}))

jest.mock('../src/services/r2', () => ({
  uploadFile: jest.fn(),
  client: {}
}))

jest.mock('../src/db/model', () => ({}))

jest.mock('../src/services/telegramApi', () => ({
  call: jest.fn()
}))

const { stopScheduler } = require('../src/services/scheduler')

const messages = require('../src/messages')

beforeAll(() => {
  process.env.BOT_TOKEN = 't'
  process.env.CHAT_ID = '1'
  process.env.JWT_SECRET = 's'
  process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
  process.env.APP_URL = 'https://localhost'
  require('../src/bot/bot')
})

afterAll(() => { jest.resetModules(); stopScheduler() })

test('/assign_task без аргументов', async () => {
  const ctx = { message: { text: '/assign_task' }, from: { id: 1 }, reply: jest.fn() }
  await handlers.assign_task(ctx)
  expect(ctx.reply).toHaveBeenCalledWith(messages.assignParamsRequired)
})

test('/upload_file без id', async () => {
  const ctx = { message: { caption: '/upload_file', document: { file_id: '1', file_unique_id:'u', file_name:'f.txt' } }, from: { id: 1 }, reply: jest.fn() }
  await handlers.upload_file(ctx)
  expect(ctx.reply).toHaveBeenCalledWith(messages.uploadParamsRequired)
})

test('/upload_file без файла', async () => {
  const ctx = { message: { caption: '/upload_file 1' }, from: { id: 1 }, reply: jest.fn() }
  await handlers.upload_file(ctx)
  expect(ctx.reply).toHaveBeenCalledWith(messages.fileRequired)
})

test('/upload_voice без файла', async () => {
  const ctx = { message: { caption: '/upload_voice 1' }, from: { id: 1 }, reply: jest.fn() }
  await handlers.upload_voice(ctx)
  expect(ctx.reply).toHaveBeenCalledWith(messages.voiceRequired)
})

test('/upload_voice сохраняет voice', async () => {
  const telegramApi = require('../src/services/telegramApi')
  telegramApi.call.mockResolvedValue({ file_path: 'v.ogg' })
  global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(1) })
  const r2 = require('../src/services/r2')
  const service = require('../src/services/service')
  const ctx = { message: { caption: '/upload_voice 1', voice: { file_id: '1', file_unique_id: 'u' } }, from: { id: 1 }, reply: jest.fn() }
  await handlers.upload_voice(ctx)
  expect(telegramApi.call).toHaveBeenCalledWith('getFile', { file_id: '1' })
  expect(r2.uploadFile).toHaveBeenCalled()
  expect(service.addAttachment).toHaveBeenCalled()
  expect(ctx.reply).toHaveBeenCalledWith(messages.fileUploaded)
})

test('/edit_last без аргументов', async () => {
  const ctx = { message: { text: '/edit_last' }, chat: { id: 1 }, reply: jest.fn() }
  await handlers.edit_last(ctx)
  expect(ctx.reply).toHaveBeenCalledWith(messages.messageIdRequired)
})

test('inline add без текста', async () => {
  const ctx = { inlineQuery: { query: 'add ' }, from: { id: 1 }, answerInlineQuery: jest.fn() }
  await handlers.inline_query(ctx)
  expect(ctx.answerInlineQuery).toHaveBeenCalledWith([], { cache_time: 0 })
})

test('inline search вызывает сервис', async () => {
  const service = require('../src/services/service')
  service.searchTasks.mockResolvedValue([{ _id: '1', title: 'T', status: 'new' }])
  const ctx = { inlineQuery: { query: 'search T' }, from: { id: 1 }, answerInlineQuery: jest.fn() }
  await handlers.inline_query(ctx)
  expect(service.searchTasks).toHaveBeenCalledWith('T')
  expect(ctx.answerInlineQuery).toHaveBeenCalled()
})

test('inline add создает задачу', async () => {
  const service = require('../src/services/service')
  service.createTask.mockResolvedValue({ _id: '1', title: 'task' })
  const ctx = { inlineQuery: { query: 'add task' }, from: { id: 1 }, answerInlineQuery: jest.fn() }
  await handlers.inline_query(ctx)
  expect(service.createTask).toHaveBeenCalledWith('task', undefined, 'В течении дня', undefined, 1)
  expect(ctx.answerInlineQuery).toHaveBeenCalled()
})
