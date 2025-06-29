#!/usr/bin/env node
// Проверка подключения к MongoDB
require('dotenv').config()
const mongoose = require('mongoose')

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


