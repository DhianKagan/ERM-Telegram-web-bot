// Назначение: автотесты. Модули: jest, supertest.
// Проверяем работу fetchKanban: корректный разбор ответа
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.JWT_SECRET = 's'
process.env.APP_URL = 'https://localhost'

const { fetchKanban } = require('../web/src/services/tasks')

afterAll(() => { delete global.fetch })

beforeEach(() => {
  global.localStorage = {
    getItem: jest.fn().mockReturnValue('t'),
    removeItem: jest.fn()
  }
  global.window = { location: { href: '' } }
})

test('fetchKanban извлекает tasks из объекта', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ tasks: [{ _id: '1', status: 'Новая', title: 't' }] })
  })
  const list = await fetchKanban()
  expect(Array.isArray(list)).toBe(true)
  expect(list[0].title).toBe('t')
})

test('fetchKanban принимает массив как есть', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([{ _id: '1' }])
  })
  const list = await fetchKanban()
  expect(list).toHaveLength(1)
})

