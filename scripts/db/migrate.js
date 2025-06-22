// Скрипт миграции MongoDB: создаёт индексы
import mongoose from 'mongoose'
import 'dotenv/config'
import '../bot/src/db/model.js'

await mongoose.connection.db.collection('tasks').createIndex({ due_date: 1 })
await mongoose.connection.db.collection('tasks').createIndex({ status: 1 })
await mongoose.connection.db.collection('tasks').createIndex({ priority: 1 })
await mongoose.connection.db.collection('users').createIndex(
  { telegram_id: 1 },
  { unique: true }
)
console.log('Индексы созданы')
process.exit(0)
