// Создание rate limiter с детальным логированием
// Модули: express-rate-limit, services/service
const rateLimit = require('express-rate-limit');
const { writeLog } = require('../services/service');

function createRateLimiter(windowMs, max) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      writeLog(
        `Превышен лимит ${req.method} ${req.originalUrl} ip:${req.ip}`,
        'warn',
      ).catch(() => {});
      res
        .status(429)
        .json({ error: 'Too many requests, please try again later.' });
    },
  });
}

module.exports = createRateLimiter;
