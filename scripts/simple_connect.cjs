#!/usr/bin/env node
// Минимальный пример подключения к MongoDB
require('dotenv').config()
const { MongoClient } = require('mongodb')
const url = process.env.MONGO_DATABASE_URL
if (!url) {
  console.error('Не задан MONGO_DATABASE_URL')
  process.exit(1)
}
const client = new MongoClient(url)
client.connect()
  .then(() => {
    console.log('Успешное подключение')
    return client.close()
  })
  .catch(e => {
    console.error('Ошибка подключения:', e.message)
    process.exit(1)
  })
