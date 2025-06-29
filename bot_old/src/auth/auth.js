// Проверка прав администратора и генерация JWT. Модули: telegraf, jsonwebtoken
const { botToken, jwtSecret, chatId } = require('../config')
const { Telegraf } = require('telegraf')
const jwt = require('jsonwebtoken')
const bot = new Telegraf(botToken)
const secretKey = jwtSecret

async function verifyAdmin (userId) {
  const admins = await bot.telegram.getChatAdministrators(chatId)
  return admins.some(a => a.user.id === userId)
}

function generateToken (user) {
  return jwt.sign({ id: user.id, username: user.username, isAdmin: user.isAdmin }, secretKey, { expiresIn: '1h' })
}

module.exports = { verifyAdmin, generateToken }

