#!/usr/bin/env node
// Проверка подключения к MongoDB
try {
  require('dotenv').config()
} catch (e) {
  if (e.code === 'MODULE_NOT_FOUND') {
    console.warn('Модуль dotenv не найден, читаем .env вручную')
    const fs = require('fs')
    const path = require('path')
    const envPath = path.resolve(__dirname, '..', '.env')
    if (fs.existsSync(envPath)) {
      const env = fs.readFileSync(envPath, 'utf8')
      env.split(/\r?\n/).forEach(line => {
        const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/(^['"]|['"]$)/g, '')
        }
      })
    }
  } else {
    throw e
  }
}
let mongoose
try {
  mongoose = require('mongoose')
} catch (e) {
  mongoose = require('../bot_old/node_modules/mongoose')
}

const url = (process.env.MONGO_DATABASE_URL || process.env.MONGODB_URI || process.env.DATABASE_URL || '').trim()
if (!url) {
  console.error('Не задан MONGO_DATABASE_URL')
  process.exit(1)
}

async function main() {
  try {
    await mongoose.connect(url)
    await mongoose.connection.db.admin().ping()
    console.log('MongoDB подключена')
    process.exit(0)
  } catch (e) {
    console.error('Ошибка подключения к MongoDB:', e.message)
    process.exit(1)
  }
}

main()


