// Скрипт миграции MongoDB: создаёт индексы
import mongoose from 'mongoose'
import 'dotenv/config'
import '../bot/src/db/model.js'

await mongoose.connection.db.collection('tasks').createIndex({ due_date: 1 })
console.log('Индексы созданы')
process.exit(0)
