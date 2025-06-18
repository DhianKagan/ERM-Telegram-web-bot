// Подключение к MongoDB и определение модели задач
require('dotenv').config()
const mongoose = require('mongoose')

if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(process.env.MONGODB_URI)
}

const taskSchema = new mongoose.Schema({
  assigned_user_id: Number,
  task_description: { type: String, required: true },
  status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' }
}, { timestamps: true })

module.exports = mongoose.model('Task', taskSchema)
