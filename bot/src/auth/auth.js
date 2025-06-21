// Проверка прав администратора и генерация JWT. Модули: telegraf, jsonwebtoken
require('dotenv').config()
const { Telegraf } = require('telegraf')
const jwt = require('jsonwebtoken')
const bot = new Telegraf(process.env.BOT_TOKEN)
const secretKey = process.env.JWT_SECRET
if (!secretKey) {
  console.error('Переменная JWT_SECRET не задана')
  process.exit(1)
}

async function verifyAdmin (userId) {
  const admins = await bot.telegram.getChatAdministrators(process.env.CHAT_ID)
  return admins.some(a => a.user.id === userId)
}

function generateToken (user) {
  return jwt.sign({ id: user.id, username: user.username, isAdmin: user.isAdmin }, secretKey, { expiresIn: '1h' })
}

module.exports = { verifyAdmin, generateToken }

