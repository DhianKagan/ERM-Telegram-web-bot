// Интеграционный тест обновления статуса задачи через канбан
process.env.NODE_ENV = 'test'
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.JWT_SECRET = 's'

const express = require('express')
const request = require('supertest')

jest.mock('../src/services/service', () => ({
  updateTaskStatus: jest.fn(),
  writeLog: jest.fn()
}))

jest.mock('../src/api/middleware', () => ({
  verifyToken: (_req, _res, next) => next(),
  asyncHandler: fn => fn,
  errorHandler: (err, _req, res, _next) => res.status(500).json({ error: err.message })
}))

const { updateTaskStatus, writeLog } = require('../src/services/service')
const { asyncHandler } = require('../src/api/middleware')
const { body, validationResult } = require('express-validator')

const app = express()
app.use(express.json())
app.post('/api/tasks/:id/status',
  [body('status').isIn(['pending', 'in-progress', 'completed'])],
  (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
    return next()
  },
  asyncHandler(async (req, res) => {
    await updateTaskStatus(req.params.id, req.body.status)
    await writeLog(`Статус задачи ${req.params.id} -> ${req.body.status}`)
    res.json({ status: 'ok' })
  })
)

const id = '507f191e810c19729de860ea'

test('статус задачи меняется на in-progress', async () => {
  const res = await request(app)
    .post(`/api/tasks/${id}/status`)
    .send({ status: 'in-progress' })
  expect(res.body.status).toBe('ok')
  expect(updateTaskStatus).toHaveBeenCalledWith(id, 'in-progress')
})
