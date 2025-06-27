// Централизованная загрузка переменных окружения.
// Модули: dotenv, process
require('dotenv').config()
const required = ['BOT_TOKEN', 'CHAT_ID', 'JWT_SECRET']
for (const k of required) {
  if (!process.env[k]) throw new Error(`Переменная ${k} не задана`)
}
const mongoUrlEnv = (process.env.MONGO_DATABASE_URL || process.env.MONGODB_URI || process.env.DATABASE_URL || '').trim()
if (!/^mongodb(\+srv)?:\/\//.test(mongoUrlEnv)) {
  throw new Error('MONGO_DATABASE_URL должен начинаться с mongodb:// или mongodb+srv://')
}
module.exports = {
  botToken: process.env.BOT_TOKEN,
  chatId: process.env.CHAT_ID,
  jwtSecret: process.env.JWT_SECRET,
  mongoUrl: mongoUrlEnv,
  r2: {
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME
  },
  appUrl: process.env.APP_URL,
  port: process.env.PORT || 3000,
  locale: process.env.LOCALE || 'ru',
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD
}
