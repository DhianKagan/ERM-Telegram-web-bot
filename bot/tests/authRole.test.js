// Тесты middleware checkRole: проверка доступа по ролям
const express = require('express')
const request = require('supertest')
const checkRole = require('../src/middleware/checkRole')
const { stopScheduler } = require('../src/services/scheduler')

function appWithRole(role) {
  const app = express()
  app.get('/admin', (req, res, next) => { req.user = { role }; next() }, checkRole('admin'), (_req, res) => res.sendStatus(200))
  return app
}

test('admin имеет доступ', async () => {
  const res = await request(appWithRole('admin')).get('/admin')
  expect(res.status).toBe(200)
})

test('пользователь получает 403', async () => {
  const res = await request(appWithRole('user')).get('/admin')
  expect(res.status).toBe(403)
})

afterAll(() => stopScheduler())
