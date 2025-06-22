const express = require('express')
const request = require('supertest')
const helmet = require('helmet')

test('helmet добавляет security headers', async () => {
  const app = express()
  app.use(helmet())
  app.get('/', (_req, res) => res.send('ok'))
  const res = await request(app).get('/')
  expect(res.headers['x-dns-prefetch-control']).toBe('off')
})
