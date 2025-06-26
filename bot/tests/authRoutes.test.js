// Интеграционные тесты регистрации и входа через REST
const express = require('express')
const request = require('supertest')

jest.mock('../src/models/User', () => ({
  create: jest.fn(),
  findOne: jest.fn()
}))

jest.mock('bcrypt', () => ({
  hash: jest.fn(async () => 'h'),
  compare: jest.fn(async () => true)
}))

jest.mock('jsonwebtoken', () => ({
  sign: () => 'jwt'
}))

process.env.JWT_SECRET = 'test'
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'

const ctrl = require('../src/controllers/authUser')
const User = require('../src/models/User')

let app
beforeAll(() => {
  app = express()
  app.use(express.json())
  app.post('/api/auth/register', ctrl.register)
  app.post('/api/auth/login', ctrl.login)
})

test('регистрация возвращает jwt', async () => {
  User.create.mockResolvedValue({ _id: '1', role: 'user' })
  const res = await request(app).post('/api/auth/register').send({
    name: 't', email: 't@t.tt', password: '123456'
  })
  expect(res.status).toBe(201)
  expect(res.body.token).toBe('jwt')
})

test('вход возвращает jwt', async () => {
  User.findOne.mockResolvedValue({ _id: '1', passwordHash: 'h', role: 'user' })
  const res = await request(app).post('/api/auth/login').send({
    email: 't@t.tt', password: '123456'
  })
  expect(res.body.token).toBe('jwt')
})
