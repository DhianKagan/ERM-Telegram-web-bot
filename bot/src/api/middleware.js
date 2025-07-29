// Middleware проверки JWT и базовая обработка ошибок.
// Модули: jsonwebtoken, config, prom-client
const jwt = require('jsonwebtoken');
const { writeLog } = require('../services/service');
const client = require('prom-client');

const csrfErrors = new client.Counter({
  name: 'csrf_errors_total',
  help: 'Количество ошибок CSRF',
});

const apiErrors = new client.Counter({
  name: 'api_errors_total',
  help: 'Количество ошибок API',
  labelNames: ['method', 'path', 'status'],
});

// Обёртка для перехвата ошибок асинхронных функций
const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (e) {
    next(e);
  }
};

// Обработчик ошибок API
// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err.type === 'request.aborted') {
    res.status(400).json({ error: 'request aborted' });
    return;
  }
  if (err.code === 'EBADCSRFTOKEN' || /CSRF token/.test(err.message)) {
    if (process.env.NODE_ENV !== 'test') {
      csrfErrors.inc();
      const header = _req.headers['x-xsrf-token']
        ? String(_req.headers['x-xsrf-token']).slice(0, 8)
        : 'none';
      const cookie =
        _req.cookies && _req.cookies['XSRF-TOKEN']
          ? String(_req.cookies['XSRF-TOKEN']).slice(0, 8)
          : 'none';
      const uid = _req.user ? `${_req.user.id}/${_req.user.username}` : 'anon';
      writeLog(
        `Ошибка CSRF-токена header:${header} cookie:${cookie} user:${uid}`,
      ).catch(() => {});
    }
    res.status(403).json({
      error:
        'Ошибка CSRF: токен недействителен или отсутствует. Обновите страницу и попробуйте ещё раз.',
    });
    apiErrors.inc({ method: _req.method, path: _req.originalUrl, status: 403 });
    return;
  }
  console.error(err);
  writeLog(
    `Ошибка ${err.message} path:${_req.originalUrl} ip:${_req.ip}`,
    'error',
  ).catch(() => {});
  const status = res.statusCode >= 400 ? res.statusCode : 500;
  res.status(status).json({ error: err.message });
  apiErrors.inc({ method: _req.method, path: _req.originalUrl, status });
}

const { jwtSecret } = require('../config');
const secretKey = jwtSecret;

// Проверка JWT-токена
function verifyToken(req, res, next) {
  const auth = req.headers['authorization'];
  let token;
  if (auth) {
    if (auth.startsWith('Bearer ')) {
      token = auth.slice(7).trim();
      if (!token) {
        writeLog(
          `Неверный формат токена ${req.method} ${req.originalUrl} ip:${req.ip}`,
        ).catch(() => {});
        apiErrors.inc({
          method: req.method,
          path: req.originalUrl,
          status: 403,
        });
        return res
          .status(403)
          .json({ message: 'Неверный формат токена авторизации' });
      }
    } else if (auth.includes(' ')) {
      const part = auth.slice(0, 8);
      writeLog(`Неверный формат токена ${part} ip:${req.ip}`).catch(() => {});
      apiErrors.inc({ method: req.method, path: req.originalUrl, status: 403 });
      return res
        .status(403)
        .json({ message: 'Неверный формат токена авторизации' });
    } else {
      token = auth;
    }
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else {
    writeLog(
      `Отсутствует токен ${req.method} ${req.originalUrl} ip:${req.ip}`,
    ).catch(() => {});
    apiErrors.inc({ method: req.method, path: req.originalUrl, status: 403 });
    return res.status(403).json({
      message: 'Токен авторизации отсутствует. Выполните вход заново.',
    });
  }

  const preview = token ? String(token).slice(0, 8) : 'none';
  jwt.verify(token, secretKey, { algorithms: ['HS256'] }, (err, decoded) => {
    if (err) {
      writeLog(`Неверный токен ${preview} ip:${req.ip}`).catch(() => {});
      apiErrors.inc({ method: req.method, path: req.originalUrl, status: 401 });
      return res
        .status(401)
        .json({ message: 'Недействительный токен. Выполните вход заново.' });
    }
    req.user = decoded;
    next();
  });
}

function requestLogger(req, res, next) {
  const { method, originalUrl, headers, cookies, ip } = req;
  const tokenVal =
    cookies && cookies.token ? cookies.token.slice(0, 8) : 'no-token';
  const csrfVal = headers['x-xsrf-token']
    ? String(headers['x-xsrf-token']).slice(0, 8)
    : 'no-csrf';
  const auth = headers.authorization;
  let authVal = 'no-auth';
  if (auth) {
    authVal = auth.startsWith('Bearer ') ? auth.slice(7, 15) : auth.slice(0, 8);
  }
  const ua = headers['user-agent']
    ? String(headers['user-agent']).slice(0, 40)
    : 'unknown';
  writeLog(
    `API запрос ${method} ${originalUrl} token:${tokenVal} auth:${authVal} csrf:${csrfVal} ip:${ip} ua:${ua}`,
  ).catch(() => {});
  res.on('finish', () => {
    writeLog(
      `API ответ ${method} ${originalUrl} ${res.statusCode} ip:${ip}`,
    ).catch(() => {});
  });
  next();
}

module.exports = { verifyToken, asyncHandler, errorHandler, requestLogger };
