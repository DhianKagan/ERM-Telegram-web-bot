// Централизованная загрузка переменных окружения.
// Модули: dotenv, process
require('dotenv').config()
const required = ['BOT_TOKEN', 'CHAT_ID', 'JWT_SECRET', 'MONGO_DATABASE_URL']
for (const k of required) {
  if (!process.env[k]) throw new Error(`Переменная ${k} не задана`)
}
module.exports = {
  botToken: process.env.BOT_TOKEN,
  chatId: process.env.CHAT_ID,
  jwtSecret: process.env.JWT_SECRET,
  mongoUrl: process.env.MONGO_DATABASE_URL,
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
