// Назначение: автотесты. Модули: jest, supertest.
// Тесты проверки координат сервиса маршрутов
process.env.NODE_ENV='test'
process.env.BOT_TOKEN='t'
process.env.CHAT_ID='1'
process.env.JWT_SECRET='s'
process.env.MONGO_DATABASE_URL='mongodb://localhost/db'
process.env.APP_URL='https://localhost'
process.env.ROUTING_URL='http://localhost:8000/route'

const { table } = require('../src/services/route')

afterEach(() => { jest.resetAllMocks() })

test('table отклоняет некорректные координаты', async () => {
  global.fetch = jest.fn()
  await expect(table('1,1;../../../etc', {})).rejects.toThrow('Некорректные координаты')
  expect(fetch).not.toHaveBeenCalled()
})
