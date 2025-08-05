// Назначение: автотесты. Модули: jest, supertest.
// Тесты сервиса maps: разворачивание ссылок и координаты
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.JWT_SECRET = 's'
process.env.APP_URL = 'https://localhost'

const { expandMapsUrl, extractCoords } = require('../src/services/maps')

const { stopScheduler } = require('../src/services/scheduler')
const { stopQueue } = require('../src/services/messageQueue')

test('expandMapsUrl возвращает полный url', async () => {
  global.fetch = jest.fn().mockResolvedValue({ url: 'https://maps.google.com/full' })
  const res = await expandMapsUrl('https://maps.app.goo.gl/test')
  expect(fetch).toHaveBeenCalledWith('https://maps.app.goo.gl/test', { redirect: 'follow' })
  expect(res).toBe('https://maps.google.com/full')
})

test('extractCoords извлекает широту и долготу', () => {
  const coords = extractCoords('https://maps.google.com/@10.1,20.2,15z')
  expect(coords).toEqual({ lat: 10.1, lng: 20.2 })
})

afterAll(() => { stopScheduler(); stopQueue() })
