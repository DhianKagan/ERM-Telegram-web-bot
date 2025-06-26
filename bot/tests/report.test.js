// Тесты отчётов KPI
process.env.NODE_ENV='test'
const express = require('express')
const request = require('supertest')

jest.mock('../src/db/queries', () => ({
  summary: jest.fn(async () => ({ count: 2, time: 30 }))
}))

const ctrl = require('../src/controllers/reportController')
const q = require('../src/db/queries')

let app
beforeAll(() => {
  app = express()
  app.get('/api/reports/summary', ctrl.summary)
})

test('фильтр по дате передаётся в summary', async () => {
  const res = await request(app).get('/api/reports/summary?from=2024-01-01&to=2024-12-31')
  expect(res.body.count).toBe(2)
  expect(q.summary).toHaveBeenCalledWith({ from: '2024-01-01', to: '2024-12-31' })
})
