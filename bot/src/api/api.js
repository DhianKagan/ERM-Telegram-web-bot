// HTTP API и мини-приложение. Модули: express, express-rate-limit,
// сервисы и middleware. Используются tasksRateLimiter и loginRateLimiter,
// есть маршрут /health для проверки статуса.
require('dotenv').config()
const express = require('express')
const rateLimit = require('express-rate-limit')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')
const setupSwagger = require('./swagger')
  const { createTask, listUserTasks, listAllTasks, updateTaskStatus,
  createGroup, listGroups, createUser, listUsers, updateTask,
  createLog, listLogs } = require('../services/service')
const { verifyToken, asyncHandler, errorHandler } = require('./middleware')
const { generateToken } = require('../auth/auth')

;(async () => {
  const { Task, Group, User } = require('../db/model')
  const app = express()
  setupSwagger(app)
  // при отсутствии статических файлов выполняем сборку мини-приложения
  const root = path.join(__dirname, '../..')
  const pub = path.join(root, 'public')
  if (fs.readdirSync(pub).length <= 1) {
    console.log('Сборка интерфейса...')
    execSync('npm run build-client', { cwd: root, stdio: 'inherit' })
  }
  // доверяем только первому прокси, чтобы получать корректный IP
  // и не допустить обход rate limit по X-Forwarded-For
  app.set('trust proxy', 1)
  app.use(express.json())

  // простая проверка работоспособности контейнера
  app.get('/health', (_req, res) => res.json({ status: 'ok' }))

  // лимит запросов к задачам: 100 за 15 минут
  const tasksRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
  })
  // лимит попыток входа: 10 за 15 минут
  const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many login attempts, please try later.' }
  })
  app.use(express.static(path.join(__dirname, '../../public')))

  app.post('/auth/login', loginRateLimiter, asyncHandler(async (req, res) => {
    const { email, password } = req.body
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      return res.status(500).json({ error: 'Credentials not set' })
    }
    if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    const token = generateToken({ id: 0, username: email, isAdmin: true })
    res.json({ token, role: 'admin', name: 'Администратор' })
  }))


  /**
   * @swagger
   * /tasks:
   *   get:
   *     summary: Список задач
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: OK
   */
  app.get('/tasks', tasksRateLimiter, verifyToken, asyncHandler(async (req, res) => {
    const tasks = req.query.userId ? await listUserTasks(req.query.userId) : await listAllTasks()
    res.json(tasks)
  }))

  /**
   * @swagger
   * /tasks:
   *   post:
   *     summary: Создать задачу
   *     security: [{ bearerAuth: [] }]
   */
  app.post('/tasks', verifyToken, asyncHandler(async (req, res) => {
    const { description, dueDate, priority } = req.body
    const task = await createTask(description, dueDate, priority)
    await createLog(`Task created: ${description}`)
    res.json(task)
  }))

  app.put('/tasks/:id', verifyToken, asyncHandler(async (req, res) => {
    await updateTask(req.params.id, req.body)
    res.json({ status: 'ok' })
  }))

  app.get('/groups', verifyToken, asyncHandler(async (_req, res) => {
    res.json(await listGroups())
  }))
  app.post('/groups', verifyToken, asyncHandler(async (req, res) => {
    const group = await createGroup(req.body.name)
    res.json(group)
  }))

  app.get('/users', verifyToken, asyncHandler(async (_req, res) => {
    res.json(await listUsers())
  }))
  app.post('/users', verifyToken, asyncHandler(async (req, res) => {
    const user = await createUser(req.body.id, req.body.username)
    res.json(user)
  }))

  /**
   * @swagger
   * /logs:
   *   get:
   *     summary: Список логов
   *     security: [{ bearerAuth: [] }]
   */
  app.get('/logs', verifyToken, asyncHandler(async (_req, res) => {
    res.json(await listLogs())
  }))

  app.post('/tasks/:id/status', verifyToken, asyncHandler(async (req, res) => {
    await updateTaskStatus(req.params.id, req.body.status)
    res.json({ status: 'ok' })
  }))

  app.use(errorHandler)

  const port = process.env.PORT || 3000
  app.listen(port, () => console.log(`API on port ${port}`))
})()
