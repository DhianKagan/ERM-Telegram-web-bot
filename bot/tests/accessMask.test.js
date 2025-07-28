// Тест функции hasAccess для разных масок
process.env.BOT_TOKEN='t'
process.env.CHAT_ID='1'
process.env.JWT_SECRET='s'
process.env.MONGO_DATABASE_URL='mongodb://localhost/db'
process.env.APP_URL='https://localhost'

const { hasAccess, ACCESS_USER, ACCESS_ADMIN, ACCESS_MANAGER } = require('../src/utils/accessMask')

afterAll(() => {
  const { stopScheduler } = require('../src/services/scheduler')
  const { stopQueue } = require('../src/services/messageQueue')
  stopScheduler();
  stopQueue();
})

test('пользователь с комбинированной маской имеет нужные права', () => {
  const mask = ACCESS_USER | ACCESS_MANAGER
  expect(hasAccess(mask, ACCESS_MANAGER)).toBe(true)
  expect(hasAccess(mask, ACCESS_ADMIN)).toBe(false)
})
