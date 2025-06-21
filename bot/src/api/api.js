// HTTP API и раздача мини-приложения. Модули: express, сервисы и middleware
require('dotenv').config()
const express = require('express')
const rateLimit = require('express-rate-limit')
const path = require('path')
const { createTask, listUserTasks, listAllTasks, updateTaskStatus,
  createGroup, listGroups, createUser, listUsers, updateTask } = require('../services/service')
const { verifyToken, asyncHandler, errorHandler } = require('./middleware')

;(async () => {
  const { Task, Group, User } = require('../db/model')
  const app = express()
  app.use(express.json())

  // Define rate limiter: maximum 100 requests per 15 minutes
  const tasksRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
  })
  app.use(express.static(path.join(__dirname, '../../public')))


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
