// Тесты доступа к странице админки
process.env.NODE_ENV='test'
process.env.BOT_TOKEN='t'
process.env.CHAT_ID='1'
process.env.JWT_SECRET='s'
process.env.MONGO_DATABASE_URL='mongodb://localhost/db'
process.env.APP_URL='https://localhost'

const express = require('express')
const request = require('supertest')
jest.unmock('jsonwebtoken')
const jwt = require('jsonwebtoken')
const initAdmin = require('../src/admin/customAdmin')
const { stopScheduler } = require('../src/services/scheduler')
const { stopQueue } = require('../src/services/messageQueue')

let app
beforeAll(() => {
  app = express()
  initAdmin(app)
})

test('без токена выдаёт заглушку', async () => {
  const res = await request(app).get('/admin')
  expect(res.text).toMatch('Только админ')
})

test('доступ админу разрешён', async () => {
  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET)
  const res = await request(app).get('/admin/').set('Authorization', `Bearer ${token}`)
  expect(res.status).toBe(200)
})

test('алиас /cp тоже работает', async () => {
  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET)
  const res = await request(app).get('/cp/').set('Authorization', `Bearer ${token}`)
  expect(res.status).toBe(200)
})

afterAll(() => { stopScheduler(); stopQueue() })
