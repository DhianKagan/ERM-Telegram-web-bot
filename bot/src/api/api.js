// HTTP API и раздача мини-приложения. Модули: express, service, middleware, errorHandler
require('dotenv').config()
const express = require('express')
const path = require('path')
const { createTask, listUserTasks, listAllTasks, updateTaskStatus } = require('../services/service')
const { verifyToken, asyncHandler, errorHandler } = require('./middleware');
const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, '../../public')))

app.get('/tasks', verifyToken, asyncHandler(async (req, res) => {
  const tasks = req.query.userId ? await listUserTasks(req.query.userId) : await listAllTasks()
  res.json(tasks)
}))

app.post('/tasks', verifyToken, asyncHandler(async (req, res) => {
  const task = await createTask(req.body.description)
  res.json(task)
}))

app.post('/tasks/:id/status', verifyToken, asyncHandler(async (req, res) => {
  await updateTaskStatus(req.params.id, req.body.status)
  res.json({ status: 'ok' })
}))

app.use(errorHandler)

// По умолчанию API слушает порт 3000
app.listen(process.env.PORT || 3000)
module.exports = app
