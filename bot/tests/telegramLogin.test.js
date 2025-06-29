const crypto = require('crypto')
jest.mock('../src/db/queries', () => ({
  getUser: jest.fn(async () => null),
  createUser: jest.fn(async () => ({}))
}))
jest.mock('../src/auth/auth', () => ({
  verifyAdmin: jest.fn(async () => false),
  generateToken: jest.fn(() => 'jwt')
}))
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.JWT_SECRET = 'secret'
process.env.APP_URL = 'https://localhost'
const ctrl = require('../src/controllers/authUser')
const { getUser, createUser } = require('../src/db/queries')
const { generateToken } = require('../src/auth/auth')
const { stopScheduler } = require('../src/services/scheduler')

function signedData() {
  const data = { id: 1, username: 'u', auth_date: Math.floor(Date.now() / 1000) }
  const secret = crypto.createHash('sha256').update(process.env.BOT_TOKEN).digest()
  const str = Object.keys(data).sort().map(k => `${k}=${data[k]}`).join('\n')
  data.hash = crypto.createHmac('sha256', secret).update(str).digest('hex')
  return data
}

test('telegramLogin creates user and returns token', async () => {
  const req = { body: signedData() }
  const res = { json: jest.fn(), status: jest.fn(() => res) }
  await ctrl.telegramLogin(req, res)
  expect(createUser).toHaveBeenCalled()
  expect(res.json).toHaveBeenCalledWith({ token: 'jwt' })
})

test('telegramLogin rejects invalid hash', async () => {
  const req = { body: { id: 1, username: 'u', auth_date: 0, hash: 'x' } }
  const res = { json: jest.fn(), status: jest.fn(() => res) }
  await ctrl.telegramLogin(req, res)
  expect(res.status).toHaveBeenCalledWith(401)
})

afterAll(() => stopScheduler())
