// HTTP API и раздача мини-приложения. Модули: express, service, middleware, AdminJS
require('dotenv').config()
const express = require('express')
const path = require('path')
const { createTask, listUserTasks, listAllTasks, updateTaskStatus } = require('../services/service')
const { verifyToken, asyncHandler, errorHandler } = require('./middleware')
const AdminJS = require('adminjs').default

;(async () => {
  const { default: AdminJSExpress } = await import('@adminjs/express')
  const { default: AdminJSMongoose } = await import('@adminjs/mongoose')
  const Task = require('../db/model')
  const app = express()
  app.use(express.json())
  app.use(express.static(path.join(__dirname, '../../public')))

  AdminJS.registerAdapter(AdminJSMongoose)
  const admin = new AdminJS({ rootPath: '/admin', resources: [{ resource: Task }] })
  const adminRouter = AdminJSExpress.buildRouter(admin)
  app.use(admin.options.rootPath, adminRouter)

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

  const port = process.env.PORT || 3000
  app.listen(port, () => console.log(`API on port ${port}`))
})()
