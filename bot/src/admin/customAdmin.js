// Кастомный бекенд админки без базовой аутентификации
// Модуль: express, path

const path = require('path')
const express = require('express')
const rateLimit = require('express-rate-limit')
const jwt = require('jsonwebtoken')
const { jwtSecret } = require('../config')

// Опциональная проверка токена: при ошибке продолжаем без пользователя
function optionalVerify(req, _res, next) {
  const auth = req.headers['authorization']
  if (!auth) return next()
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth.trim()
  jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }, (err, decoded) => {
    if (!err) req.user = decoded
    next()
  })
}


function initCustomAdmin(app) {
  // Доступ контролируется ролью пользователя из базы данных

  const router = express.Router();
  const pub = path.join(__dirname, '../../public');

  // Rate limiter: max 100 requests per 15 minutes
  const adminRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  });

  router.use(adminRateLimiter)
  router.use(optionalVerify)
  router.use((req, res, next) => {
    if (req.user && req.user.role === 'admin') return next()
    res.sendFile(path.join(pub, 'admin-placeholder.html'))
  })
  router.use(express.static(pub))
  // Express 5 использует синтаксис `/*splat` для wildcard-маршрута
  router.get('/*splat', (_req, res) => {
    res.sendFile(path.join(pub, 'index.html'))
  })
  app.use(['/admin', '/cp'], router)

}

module.exports = initCustomAdmin;
