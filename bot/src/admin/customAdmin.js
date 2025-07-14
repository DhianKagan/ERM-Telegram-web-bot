// Кастомный бекенд админки без базовой аутентификации
// Модуль: express, path
const path = require('path')
const express = require('express')
const rateLimit = require('express-rate-limit')
const { verifyToken } = require('../api/middleware')
const checkRole = require('../middleware/checkRole')

function initCustomAdmin(app) {
  // Доступ контролируется ролью пользователя из базы данных
  
  const router = express.Router()
  const pub = path.join(__dirname, '../../public')

  // Rate limiter: max 100 requests per 15 minutes
  const adminRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  })

  router.use(adminRateLimiter)
  router.use(verifyToken, checkRole('admin'))
  router.use(express.static(pub))
  router.get('*', (_req, res) => {
    res.sendFile(path.join(pub, 'index.html'))
  })
  app.use('/admin', router)
}

module.exports = initCustomAdmin
