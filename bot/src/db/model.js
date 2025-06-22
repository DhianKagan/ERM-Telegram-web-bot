// Подключение к MongoDB и определение моделей. Модули: mongoose, config
const mongoose = require('mongoose')
const { mongoUrl } = require('../config')

if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(mongoUrl).catch(e => {
    console.error('Ошибка подключения к MongoDB:', e.message)
    process.exit(1)
  })
}

const taskSchema = new mongoose.Schema({
  assigned_user_id: Number,
  group_id: mongoose.Schema.Types.ObjectId,
  task_description: { type: String, required: true },
  due_date: Date,
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' }
}, { timestamps: true })

const groupSchema = new mongoose.Schema({ name: String })
const userSchema = new mongoose.Schema({ telegram_id: Number, username: String })
const roleSchema = new mongoose.Schema({ name: String })
const logSchema = new mongoose.Schema({
  message: String,
  level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' }
}, { timestamps: true })

const Task = mongoose.model('Task', taskSchema)
const Group = mongoose.model('Group', groupSchema)
const User = mongoose.model('User', userSchema)
const Role = mongoose.model('Role', roleSchema)
const Log = mongoose.model('Log', logSchema)

module.exports = { Task, Group, User, Role, Log }
