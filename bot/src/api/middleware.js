// Middleware JWT для проверки доступа к API. Модуль: jsonwebtoken
const jwt = require('jsonwebtoken');

const secretKey = process.env.JWT_SECRET;
if (!secretKey) {
  console.error('Переменная JWT_SECRET не задана');
  process.exit(1);
}

// Middleware to verify JWT token
function verifyToken(req, res, next) {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(403).json({ message: 'No token provided' });
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    req.user = decoded; 
    next();
  });
}

module.exports = { verifyToken };
