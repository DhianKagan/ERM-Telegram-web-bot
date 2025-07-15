// Генерация JWT. Модули: jsonwebtoken
const { jwtSecret } = require('../config')
const jwt = require('jsonwebtoken')
const secretKey = jwtSecret

function generateToken (user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, secretKey, {
    expiresIn: '1h',
    algorithm: 'HS256'
  })
}

module.exports = { generateToken }

