// Модели MongoDB. Подключение выполняет модуль connection.js
const mongoose = require('mongoose')
const connect = require('./connection')

if (process.env.NODE_ENV !== 'test') {
  connect().catch(async (e) => {
    console.error('Ошибка подключения к MongoDB:', e.message)
    for (let attempt = 1; attempt <= 3; attempt++) {
      await new Promise(r => setTimeout(r, 5000))
      try {
        await connect()
        console.log('MongoDB подключена после повторной попытки')
        return
      } catch (err) {
        console.error(`Повторная попытка ${attempt} не удалась:`, err.message)
      }
    }
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
  task_type_id: Number,
  due_date: Date,
  remind_at: Date,
  location: String,
  start_location: String,
  start_location_link: String,
  end_location: String,
  end_location_link: String,
  assigned_user_id: Number,
  controller_user_id: Number,
  assignees: [Number],
  group_id: mongoose.Schema.Types.ObjectId,
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  priority: { type: String, enum: ['Срочно', 'В течении дня', 'Бессрочно'], default: 'В течении дня' },
  priority_id: Number,
  created_by: Number,
  comments: [{ author_id: Number, text: String, created_at: { type: Date, default: Date.now } }],
  status: { type: String, enum: ['new', 'in-progress', 'done'], default: 'new' },
  checklist: [checklistItemSchema],
  comment: String,
  files: [String],
  attachments: [{ name: String, url: String }],
  telegram_topic_id: Number,
  time_spent: { type: Number, default: 0 }
}, { timestamps: true })

const groupSchema = new mongoose.Schema({ name: String })
const userSchema = new mongoose.Schema({
  telegram_id: Number,
  username: String,
  // Email используется для совместимости со старым индексом в базе.
  // Сохраняем уникальное значение на основе telegram_id.
  email: { type: String, unique: true },
  // Роль пользователя хранится через ссылку на коллекцию roles
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  // Настройка получения напоминаний планировщиком
  receive_reminders: { type: Boolean, default: true }
})
const roleSchema = new mongoose.Schema({ name: String })
const departmentSchema = new mongoose.Schema({ name: String })
const logSchema = new mongoose.Schema({
  message: String,
  level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' }
}, { timestamps: true })

const Task = mongoose.model('Task', taskSchema)
const Group = mongoose.model('Group', groupSchema)
const Department = mongoose.model('Department', departmentSchema)
// Коллекция пользователей бота отличается от AuthUser и хранится отдельно
// Название коллекции меняем на `telegram_users`, чтобы избежать конфликтов
// с историческими индексами, которые могли остаться в `users`
const User = mongoose.model('User', userSchema, 'telegram_users')
const Role = mongoose.model('Role', roleSchema)
const Log = mongoose.model('Log', logSchema)

module.exports = { Task, Group, User, Role, Department, Log }
