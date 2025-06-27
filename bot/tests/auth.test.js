// Тесты модуля auth: проверка админа и JWT. Используются telegraf и jsonwebtoken.
jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    telegram: { getChatAdministrators: jest.fn().mockResolvedValue([{ user: { id: 1 } }]) }
  }))
}))
jest.mock('jsonwebtoken')
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.JWT_SECRET = 'test'
process.env.APP_URL = 'https://localhost'
const { verifyAdmin, generateToken } = require('../src/auth/auth')
const jwt = require('jsonwebtoken')

test('verifyAdmin true for admin id', async () => {
  const ok = await verifyAdmin(1)
  expect(ok).toBe(true)
})

test('verifyAdmin false for non admin', async () => {
  const ok = await verifyAdmin(2)
  expect(ok).toBe(false)
})

test('generateToken returns valid jwt', () => {
  const token = generateToken({ id: 5, username: 'a', isAdmin: true })
const data = jwt.decode(token)
  expect(data.id).toBe(5)
})
