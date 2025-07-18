// Кастомный бекенд админки без базовой аутентификации
// Модуль: express, path
const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../api/middleware');

function initCustomAdmin(app) {
  // Доступ контролируется ролью пользователя из базы данных

  const router = express.Router();
  const pub = path.join(__dirname, '../../public');

  // Rate limiter: max 100 requests per 15 minutes
  const adminRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  });

  router.use(adminRateLimiter);
  // статика отдаётся без проверки токена
  router.use(express.static(pub, { index: false }));

  // Поддержка токена через параметр ?token= для первого запроса
  router.use((req, _res, next) => {
    if (!req.headers.authorization && req.query.token) {
      req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
  });

  router.use(verifyToken);
  router.use((req, res, next) => {
    if (req.user.role === 'admin') return next();
    res.sendFile(path.join(pub, 'admin-placeholder.html'));
  });

  // Express 5 использует синтаксис `/*splat` для wildcard-маршрута
  router.get('/*splat', (_req, res) => {
    res.sendFile(path.join(pub, 'index.html'));
  });
  // Панель управления расположена на /cp
  app.use('/cp', router);
}

module.exports = initCustomAdmin;
