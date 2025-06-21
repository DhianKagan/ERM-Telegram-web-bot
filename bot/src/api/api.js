// HTTP API и раздача мини-приложения. Модули: express, express-rate-limit,
// сервисы и middleware. Включает маршрут /health для проверки статуса.
require('dotenv').config()
const express = require('express')
const rateLimit = require('express-rate-limit')
const path = require('path')
const { createTask, listUserTasks, listAllTasks, updateTaskStatus,
  createGroup, listGroups, createUser, listUsers, updateTask } = require('../services/service')
const { verifyToken, asyncHandler, errorHandler } = require('./middleware')
const { generateToken } = require('../auth/auth')

;(async () => {
  const { Task, Group, User } = require('../db/model')
  const app = express()
  // доверяем только первому прокси, чтобы получать корректный IP
  // и не допустить обход rate limit по X-Forwarded-For
  app.set('trust proxy', 1)
  app.use(express.json())

  // простая проверка работоспособности контейнера
  app.get('/health', (_req, res) => res.json({ status: 'ok' }))

  // Define rate limiter: maximum 100 requests per 15 minutes
  const tasksRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
  })
  app.use(express.static(path.join(__dirname, '../../public')))

  app.post('/auth/login', asyncHandler(async (req, res) => {
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


  app.get('/tasks', tasksRateLimiter, verifyToken, asyncHandler(async (req, res) => {
    const tasks = req.query.userId ? await listUserTasks(req.query.userId) : await listAllTasks()
    res.json(tasks)
  }))

  app.post('/tasks', verifyToken, asyncHandler(async (req, res) => {
    const { description, dueDate, priority } = req.body
    const task = await createTask(description, dueDate, priority)
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

  app.post('/tasks/:id/status', verifyToken, asyncHandler(async (req, res) => {
    await updateTaskStatus(req.params.id, req.body.status)
    res.json({ status: 'ok' })
  }))

  app.use(errorHandler)

  const port = process.env.PORT || 3000
  app.listen(port, () => console.log(`API on port ${port}`))
})()
