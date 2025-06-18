// Проверка прав администратора и генерация JWT
require('dotenv').config()
const Bot = require('node-telegram-bot-api')
const jwt = require('jsonwebtoken')
const bot = new Bot(process.env.BOT_TOKEN)
const secretKey = process.env.JWT_SECRET || 'secret'

async function verifyAdmin (userId) {
  const admins = await bot.getChatAdministrators(process.env.CHAT_ID)
  return admins.some(a => a.user.id === userId)
}

function generateToken (user) {
  return jwt.sign({ id: user.id, username: user.username, isAdmin: user.isAdmin }, secretKey, { expiresIn: '1h' })
}

module.exports = { verifyAdmin, generateToken }

