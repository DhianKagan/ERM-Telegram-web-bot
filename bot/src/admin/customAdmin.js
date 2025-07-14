// Кастомный бекенд админки на основе express-basic-auth
// Модуль: express, express-basic-auth, path
const path = require('path')
const express = require('express')
const basicAuth = require('express-basic-auth')

function initCustomAdmin(app) {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin'
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password'
  app.use('/admin', basicAuth({ users: { [ADMIN_EMAIL]: ADMIN_PASSWORD }, challenge: true }))

  const router = express.Router()
  const pub = path.join(__dirname, '../../public')
  router.use(express.static(pub))
  router.get('*', (_req, res) => {
    res.sendFile(path.join(pub, 'index.html'))
  })
  app.use('/admin', router)
}

module.exports = initCustomAdmin
