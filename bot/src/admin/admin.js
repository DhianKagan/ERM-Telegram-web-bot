// Административная панель на основе AdminJS
// Модули: AdminJS, @adminjs/express, @adminjs/mongoose, express, mongoose модели
const AdminJS = require('adminjs')
// @adminjs/express и @adminjs/mongoose доступны только как ES-модули,
// поэтому их импорт выполняется динамически
const { Task, Archive, Group, User, Role, Department, Log } = require('../db/model')

async function initAdmin(app) {
  const { default: AdminJSMongoose } = await import('@adminjs/mongoose')
  AdminJS.registerAdapter(AdminJSMongoose)
  const { default: AdminJSExpress } = await import('@adminjs/express')
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

module.exports = initAdmin
