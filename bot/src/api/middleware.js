// Middleware проверки JWT и базовая обработка ошибок.
// Модуль: jsonwebtoken
const jwt = require('jsonwebtoken');

// Обёртка для перехвата ошибок асинхронных функций
const asyncHandler = fn => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (e) {
    next(e);
  }
};

// Обработчик ошибок API
function errorHandler(err, _req, res, _next) {
  console.error(err);
  res.status(500).json({ error: err.message });
}

const secretKey = process.env.JWT_SECRET;
if (!secretKey) {
  console.error('Переменная JWT_SECRET не задана');
  process.exit(1);
}

// Проверка JWT-токена
function verifyToken(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(403).json({ message: 'No token provided' });

  let token;
  if (auth.startsWith('Bearer ')) {
    token = auth.slice(7).trim();
    if (!token) return res.status(403).json({ message: 'Invalid token format' });
  } else if (auth.includes(' ')) {
    return res.status(403).json({ message: 'Invalid token format' });
  } else {
    token = auth;
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });
    req.user = decoded;
    next();
  });
}

module.exports = { verifyToken, asyncHandler, errorHandler };
