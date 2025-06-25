// Скрипт миграции MongoDB: создаёт индексы
import mongoose from 'mongoose'
import 'dotenv/config'
import '../bot/src/db/model.js'

await mongoose.connection.db.collection('tasks').createIndex({ due_date: 1 })
await mongoose.connection.db.collection('tasks').createIndex({ status: 1 })
await mongoose.connection.db.collection('tasks').createIndex({ priority: 1 })
await mongoose.connection.db.collection('tasks').createIndex({ group_id: 1 })
await mongoose.connection.db.collection('tasks').createIndex({ assigned_user_id: 1 })
const users = mongoose.connection.db.collection('users')
const list = await users.indexes()
if (list.some(i => i.name === 'email_1')) {
  await users.dropIndex('email_1')
  console.log('Удалён устаревший индекс email_1')
}
await users.createIndex({ telegram_id: 1 }, { unique: true })
await mongoose.connection.db.collection('roles').createIndex(
  { name: 1 },
  { unique: true }
)
await mongoose.connection.db.collection('logs').createIndex({ level: 1 })
console.log('Индексы созданы')
process.exit(0)
