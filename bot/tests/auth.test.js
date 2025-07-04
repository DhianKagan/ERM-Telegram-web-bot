// Тесты модуля auth: проверка админа и JWT. Используются telegraf и jsonwebtoken.
jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    telegram: { getChatAdministrators: jest.fn().mockResolvedValue([{ user: { id: 1 } }]) }
  }))
}))
jest.mock('jsonwebtoken')
jest.mock('../src/services/telegramApi', () => ({ call: jest.fn() }))
jest.mock('../src/services/gateway', () => ({ sendSms: jest.fn() }))
jest.mock('../src/services/userInfoService', () => ({
  getMemberStatus: jest.fn(async () => 'member')
}))
jest.mock('../src/db/queries', () => ({
  getUser: jest.fn(async () => null),
  createUser: jest.fn(async () => ({ username: 'u' }))
}))
jest.useFakeTimers().setSystemTime(0)
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.JWT_SECRET = 'test'
process.env.APP_URL = 'https://localhost'
const { verifyAdmin, generateToken } = require('../src/auth/auth')
const jwt = require('jsonwebtoken')
const { stopScheduler } = require('../src/services/scheduler')
const { stopQueue } = require('../src/services/messageQueue')
const authCtrl = require('../src/controllers/authController')

afterEach(() => {
  authCtrl.codes.clear()
  jest.setSystemTime(0)
})

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

test('sendCode сохраняет код с таймстампом', async () => {
  const req = { body: { telegramId: 5 } }
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() }
  await authCtrl.sendCode(req, res)
  const entry = authCtrl.codes.get('5')
  expect(typeof entry.ts).toBe('number')
  expect(entry.code).toHaveLength(6)
})

test('verifyCode отклоняет просроченный код', () => {
  const req = { body: { telegramId: 111 } }
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() }
  authCtrl.sendCode(req, res)
  const code = authCtrl.codes.get('111').code
  jest.setSystemTime(6 * 60 * 1000)
  const res2 = { json: jest.fn(), status: jest.fn().mockReturnThis() }
  authCtrl.verifyCode({ body: { telegramId: 111, code } }, res2)
  expect(res2.status).toHaveBeenCalledWith(400)
  expect(authCtrl.codes.has('111')).toBe(false)
})

test('verifyCode возвращает токен', async () => {
  const req = { body: { telegramId: 7 } }
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() }
  await authCtrl.sendCode(req, res)
  const code = authCtrl.codes.get('7').code
  const res2 = { json: jest.fn(), status: jest.fn().mockReturnThis() }
  await authCtrl.verifyCode({ body: { telegramId: 7, code, username: 'u' } }, res2)
  expect(res2.json).toHaveBeenCalledWith({ token: expect.any(String) })
})

test('clean удаляет старые записи при новом вызове', async () => {
  const req1 = { body: { phone: '1' } }
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() }
  await authCtrl.sendCode(req1, res)
  jest.setSystemTime(6 * 60 * 1000)
  const req2 = { body: { phone: '2' } }
  await authCtrl.sendCode(req2, res)
  expect(authCtrl.codes.size).toBe(1)
})

afterAll(() => { stopScheduler(); stopQueue() })
