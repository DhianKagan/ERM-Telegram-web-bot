// Централизованная загрузка переменных окружения.
// Модули: dotenv, process
const path = require('path')
// Загружаем .env из корня проекта, чтобы избежать undefined переменных при запуске из каталога bot
require('dotenv').config({ path: path.resolve(__dirname, '../..', '.env') })
const required = ['BOT_TOKEN', 'CHAT_ID', 'JWT_SECRET', 'APP_URL']
for (const k of required) {
  if (!process.env[k]) throw new Error(`Переменная ${k} не задана`)
}
const mongoUrlEnv = (process.env.MONGO_DATABASE_URL || process.env.MONGODB_URI || process.env.DATABASE_URL || '').trim()
if (!/^mongodb(\+srv)?:\/\//.test(mongoUrlEnv)) {
  throw new Error('MONGO_DATABASE_URL должен начинаться с mongodb:// или mongodb+srv://')
}
const appUrlEnv = (process.env.APP_URL || '').trim()
if (!/^https:\/\//.test(appUrlEnv)) {
  throw new Error('APP_URL должен начинаться с https://, иначе Web App не будет работать')
}
module.exports = {
  botToken: process.env.BOT_TOKEN,
  botApiUrl: process.env.BOT_API_URL,
  chatId: process.env.CHAT_ID,
  jwtSecret: process.env.JWT_SECRET,
  mongoUrl: mongoUrlEnv,
  r2: {
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME
  },
  appUrl: appUrlEnv,
  port: process.env.PORT || 3000,
  locale: process.env.LOCALE || 'ru',
  routingUrl: process.env.ROUTING_URL || 'http://localhost:8000/route',
  gateway: {
    key: process.env.GATEWAY_API_KEY,
    sender: process.env.GATEWAY_SENDER
  }
}
