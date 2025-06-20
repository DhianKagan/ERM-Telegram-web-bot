// Подключение к MongoDB и определение модели задач. Модули: dotenv, mongoose
require('dotenv').config()
const mongoose = require('mongoose')

if (!process.env.MONGO_DATABASE_URL) {
  console.error('MONGO_DATABASE_URL не задан')
  process.exit(1)
}
if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(process.env.MONGO_DATABASE_URL).catch(e => {
    console.error('Ошибка подключения к MongoDB:', e.message)
    process.exit(1)
  })
}

const taskSchema = new mongoose.Schema({
  assigned_user_id: Number,
  task_description: { type: String, required: true },
  status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' }
}, { timestamps: true })

module.exports = mongoose.model('Task', taskSchema)
