jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => ({
    getChatAdministrators: jest.fn().mockResolvedValue([{ user: { id: 1 } }])
  }))
})
jest.mock('jsonwebtoken')
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
