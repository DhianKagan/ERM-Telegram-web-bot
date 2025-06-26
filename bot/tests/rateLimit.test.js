process.env.NODE_ENV='test'
const express = require('express')
const request = require('supertest')
const router = require('../src/routes/tasks')

jest.mock('../src/db/model', () => ({
  Task: { find: jest.fn(async()=>[]), findById: jest.fn(), findByIdAndUpdate: jest.fn(), create: jest.fn(), updateMany: jest.fn(), aggregate: jest.fn() }
}))

jest.mock('../src/api/middleware', () => ({ verifyToken: (_req,_res,next)=>next(), errorHandler: (err,_req,res,_next)=>res.status(500).json({error:err.message}), checkRole: () => (_req,_res,next)=>next() }))

test('лимитер detailLimiter возвращает 429', async () => {
  const app = express()
  app.use('/api/tasks', router)
  for (let i=0; i<100; i++) await request(app).get('/api/tasks/1')
  const res = await request(app).get('/api/tasks/1')
  expect(res.status).toBe(429)
})
