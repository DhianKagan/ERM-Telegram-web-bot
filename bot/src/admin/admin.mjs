// Административная панель на основе AdminJS
// Модули: AdminJS, @adminjs/express, @adminjs/mongoose, express, mongoose модели
import AdminJS from 'adminjs'
import AdminJSExpress from '@adminjs/express'
import * as AdminJSMongoose from '@adminjs/mongoose'
import models from '../db/model.js'
const { Task, Archive, Group, User, Role, Department, Log } = models
import connect from '../db/connection.js'

async function initAdmin(app) {
  await connect()
  AdminJS.registerAdapter(AdminJSMongoose)
  const admin = new AdminJS({
    rootPath: '/admin',
    resources: [Task, Archive, Group, User, Role, Department, Log]
  })
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin'
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password'
  const router = AdminJSExpress.buildAuthenticatedRouter(admin, {
    authenticate: async (email, password) => email === ADMIN_EMAIL && password === ADMIN_PASSWORD,
    cookieName: 'adminjs',
    cookiePassword: process.env.JWT_SECRET || 'secret'
  })
  app.use(admin.options.rootPath, router)
}

export default initAdmin
