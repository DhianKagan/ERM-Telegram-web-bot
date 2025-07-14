// Кастомный бекенд админки на основе express-basic-auth
// Модуль: express, express-basic-auth, path
const path = require('path')
const express = require('express')
const basicAuth = require('express-basic-auth')
const rateLimit = require('express-rate-limit')

function initCustomAdmin(app) {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin'
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password'
  app.use('/admin', basicAuth({ users: { [ADMIN_EMAIL]: ADMIN_PASSWORD }, challenge: true }))

  const router = express.Router()
  const pub = path.join(__dirname, '../../public')

  // Rate limiter: max 100 requests per 15 minutes
  const adminRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  })

  router.use(adminRateLimiter)
  router.use(express.static(pub))
  router.get('*', (_req, res) => {
    res.sendFile(path.join(pub, 'index.html'))
  })
  app.use('/admin', router)
}

module.exports = initCustomAdmin
