// Административная панель на основе AdminJS
// Модули: AdminJS, @adminjs/express, @adminjs/mongoose, express, mongoose модели
const AdminJS = require('adminjs')
const AdminJSExpress = require('@adminjs/express')
const AdminJSMongoose = require('@adminjs/mongoose')
const { Task, Archive, Group, User, Role, Department, Log } = require('../db/model')

AdminJS.registerAdapter(AdminJSMongoose)

function initAdmin(app) {
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
