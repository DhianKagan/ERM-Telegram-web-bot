// Тест полного цикла логина и создания задачи
// Модули: express, cookie-parser, express-session, lusca, supertest
process.env.NODE_ENV = 'test'
process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.JWT_SECRET = 'secret'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.APP_URL = 'https://localhost'

const express = require('express')
const cookieParser = require('cookie-parser')
const session = require('express-session')
const lusca = require('lusca')
const https = require('https')
const fs = require('fs')
const request = require('supertest')
jest.unmock('jsonwebtoken')

jest.mock('../src/services/telegramApi', () => ({ call: jest.fn() }))
jest.mock('../src/services/userInfoService', () => ({
  getMemberStatus: jest.fn(async () => 'member'),
}))

jest.mock('../src/services/tasks', () => ({
  create: jest.fn(async (d) => ({ _id: '1', ...d })),
  get: jest.fn(),
  getById: jest.fn(),
  update: jest.fn(),
  addTime: jest.fn(),
  bulk: jest.fn(),
  remove: jest.fn(),
  summary: jest.fn(),
  mentioned: jest.fn(),
}))

jest.mock('../src/middleware/taskAccess', () => (_req,_res,next)=> next())

jest.mock('../src/db/queries', () => ({
  getUser: jest.fn(async () => null),
  createUser: jest.fn(async () => ({ username: 'u' })),
  updateUser: jest.fn(async () => ({})),
}))

const authRouter = require('../src/routes/authUser')
const tasksRouter = require('../src/routes/tasks')
const { verifyToken, errorHandler } = require('../src/api/middleware')
const { codes } = require('../src/services/otp')
const { stopScheduler } = require('../src/services/scheduler')
const { stopQueue } = require('../src/services/messageQueue')

const key = fs.readFileSync(__dirname + '/test-key.pem')
const cert = fs.readFileSync(__dirname + '/test-cert.pem')

let app
let server
let baseUrl
beforeAll(
  () =>
    new Promise((res) => {
      app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.set('trust proxy', 1)
  app.use(
    session({
      secret: 'test',
      resave: false,
      saveUninitialized: true,
      cookie: {
        secure: true,
        sameSite: 'none',
        domain: 'localhost',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  )
  const csrf = lusca.csrf({ angular: true, cookie: { options: { sameSite: 'none', domain: 'localhost' } } })
  app.use((req, res, next) => {
    const url = req.originalUrl.split('?')[0]
    if (['/api/v1/auth/send_code', '/api/v1/auth/verify_code', '/api/v1/csrf'].includes(url)) {
      return next()
    }
    return csrf(req, res, next)
  })
  app.get('/api/v1/csrf', csrf, (req, res) => {
    res.json({ csrfToken: req.csrfToken() })
  })
  app.use('/api/v1/auth', authRouter)
  app.use('/api/v1/tasks', tasksRouter)
  app.use(errorHandler)
      server = https.createServer({ key, cert }, app)
      server.listen(0, 'localhost', () => {
        baseUrl = `https://localhost:${server.address().port}`
        res()
      })
    }),
)

afterAll(() => {
  server.close()
  stopScheduler()
  stopQueue()
})

test('полный цикл логина и создания задачи', async () => {
  const agent = request.agent(baseUrl, { ca: cert })
  const csrfRes = await agent.get('/api/v1/csrf').set('X-Forwarded-Proto', 'https')
  const token = csrfRes.body.csrfToken
  expect(token).toBeDefined()
  await agent.post('/api/v1/auth/send_code').set('X-Forwarded-Proto', 'https').send({ telegramId: 1 })
  const code = codes.get('1').code
  const verifyRes = await agent
    .post('/api/v1/auth/verify_code')
    .set('X-Forwarded-Proto', 'https')
    .set('X-XSRF-TOKEN', token)
    .send({ telegramId: 1, code, username: 'u' })
  const csrfRes2 = await agent.get('/api/v1/csrf').set('X-Forwarded-Proto', 'https')
  const token2 = csrfRes2.body.csrfToken
  const res = await agent
    .post('/api/v1/tasks')
    .set('X-Forwarded-Proto', 'https')
    .set('X-XSRF-TOKEN', token2)
    .set('Authorization', `Bearer ${verifyRes.body.token}`)
    .send({ title: 'T' })
  expect(res.status).toBe(201)
})
