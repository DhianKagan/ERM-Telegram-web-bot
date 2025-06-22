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
  due_date: Date,
  assigned_user_id: Number,
  assignees: [Number],
  group_id: mongoose.Schema.Types.ObjectId,
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  status: { type: String, enum: ['new', 'in-progress', 'done'], default: 'new' },
  checklist: [checklistItemSchema],
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
const User = mongoose.model('User', userSchema)
const Role = mongoose.model('Role', roleSchema)
const Log = mongoose.model('Log', logSchema)

module.exports = { Task, Group, User, Role, Log }
