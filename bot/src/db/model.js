// Модели MongoDB. Подключение выполняет модуль connection.js
const mongoose = require('mongoose')
const connect = require('./connection')

if (process.env.NODE_ENV !== 'test') {
  connect().catch(e => {
    console.error('Ошибка подключения к MongoDB:', e.message)
    process.exit(1)
  })
}

const checklistItemSchema = new mongoose.Schema({
  text: String,
  done: { type: Boolean, default: false }
}, { _id: false })

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  task_description: String,
  task_type: { type: String, enum: ['Доставить', 'Купить', 'Выполнить'] },
  due_date: Date,
  location: String,
  start_location: String,
  end_location: String,
  assigned_user_id: Number,
  controller_user_id: Number,
  assignees: [Number],
  group_id: mongoose.Schema.Types.ObjectId,
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  status: { type: String, enum: ['new', 'in-progress', 'done'], default: 'new' },
  checklist: [checklistItemSchema],
  comment: String,
  files: [String],
  time_spent: { type: Number, default: 0 }
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
// Коллекция пользователей бота отличается от AuthUser и хранится отдельно
// Название коллекции меняем на `telegram_users`, чтобы избежать конфликтов
// с историческими индексами, которые могли остаться в `users`
const User = mongoose.model('User', userSchema, 'telegram_users')
const Role = mongoose.model('Role', roleSchema)
const Log = mongoose.model('Log', logSchema)

module.exports = { Task, Group, User, Role, Log }
