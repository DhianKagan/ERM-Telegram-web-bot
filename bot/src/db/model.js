// Модели MongoDB. Подключение выполняет модуль connection.js
const mongoose = require('mongoose')
const slugify = require('slugify')
const connect = require('./connection')

if (process.env.NODE_ENV !== 'test') {
  connect().catch(e => {
    console.error('Не удалось подключиться к MongoDB:', e.message)
    process.exit(1)
  })
}

const checklistItemSchema = new mongoose.Schema({
  text: String,
  done: { type: Boolean, default: false }
}, { _id: false })

const applicantSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  department: String
}, { _id: false })

const logisticsSchema = new mongoose.Schema({
  start_location: String,
  end_location: String,
  start_date: Date,
  end_date: Date,
  transport: String,
  transport_type: {
    type: String,
    enum: ['Пешком', 'Авто', 'Дрон'],
    default: 'Авто'
  }
}, { _id: false })

const itemSchema = new mongoose.Schema({
  name: String,
  quantity: Number,
  cost: Number
}, { _id: false })

const procurementSchema = new mongoose.Schema({
  items: [itemSchema],
  vendor: String,
  total_cost: Number,
  payment_method: {
    type: String,
    enum: ['Наличные', 'Карта', 'Безнал', 'Без оплаты'],
    default: 'Карта'
  }
}, { _id: false })

const workSchema = new mongoose.Schema({
  description: String,
  deadline: Date,
  performers: [Number]
}, { _id: false })

const taskSchema = new mongoose.Schema({
  request_id: String,
  submission_date: Date,
  applicant: applicantSchema,
  logistics_details: logisticsSchema,
  procurement_details: procurementSchema,
  work_details: workSchema,
  title: { type: String, required: true },
  slug: String,
  task_description: { type: String, maxlength: 4096 },
  // Тип задачи пополнился вариантами строительства и ремонта
  task_type: {
    type: String,
    enum: ['Доставить', 'Купить', 'Выполнить', 'Построить', 'Починить']

  },
  task_type_id: Number,
  start_date: Date,
  due_date: Date,
  remind_at: Date,
  location: String,
  start_location: String,
  start_location_link: String,
  startCoordinates: { lat: Number, lng: Number },
  end_location: String,
  end_location_link: String,
  finishCoordinates: { lat: Number, lng: Number },
  google_route_url: String,
  // Расстояние маршрута в километрах
  route_distance_km: Number,
  // Список узлов маршрута для анализа
  route_nodes: [Number],
  assigned_user_id: Number,
  controller_user_id: Number,
  controllers: [Number],
  assignees: [Number],
  group_id: mongoose.Schema.Types.ObjectId,
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  priority: { type: String, enum: ['Срочно', 'В течение дня', 'Бессрочно'], default: 'В течение дня' },
  priority_id: Number,
  created_by: Number,
  comments: [{ author_id: Number, text: { type: String, maxlength: 4096 }, created_at: { type: Date, default: Date.now } }],
  status: {
    type: String,
    enum: ['Новая', 'В работе', 'Выполнена', 'Отменена'],
    default: 'Новая'
  },
  completed_at: Date,
  completion_result: {
    type: String,
    enum: ['full', 'partial', 'changed']
  },
  cancel_reason: {
    type: String,
    enum: ['technical', 'canceled', 'declined']
  },
  checklist: [checklistItemSchema],
  comment: { type: String, maxlength: 4096 },
  files: [String],
  attachments: [{ name: String, url: String }],
  transport_type: { type: String, enum: ['Пешком', 'Авто', 'Дрон'], default: 'Авто' },

  // Способ оплаты допускает отсутствие оплаты
  payment_method: {
    type: String,
    enum: ['Наличные', 'Карта', 'Безнал', 'Без оплаты'],
    default: 'Карта'
  },

  telegram_topic_id: Number,
  time_spent: { type: Number, default: 0 },
  custom_fields: mongoose.Schema.Types.Mixed
}, { timestamps: true })

taskSchema.pre('save', async function(next) {
  if (!this.request_id) {
    const count = await this.constructor.countDocuments()
    const num = String(count + 1).padStart(6, '0')
    this.request_id = `ERM_${num}`
  }
  if (this.isNew && this.title) {
    this.title = `${this.request_id} ${this.title}`
  } else if (!this.title) {
    this.title = this.request_id
  }
  this.slug = slugify(this.title, { lower: true, strict: true })
  next()
})

const groupSchema = new mongoose.Schema({ name: String })
const userSchema = new mongoose.Schema({
  telegram_id: Number,
  username: String,
  // Полное имя пользователя для отображения в интерфейсе
  name: String,
  // Номер телефона для связи
  phone: String,
  // Email используется для совместимости со старым индексом в базе.
  // Сохраняем уникальное значение на основе telegram_id.
  email: { type: String, unique: true },
  // Роль пользователя хранится строкой, по умолчанию обычный пользователь
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  // Настройка получения напоминаний планировщиком
  receive_reminders: { type: Boolean, default: true },
  // Дата прохождения верификации через Bot API
  verified_at: Date
})
const departmentSchema = new mongoose.Schema({ name: String })
const logSchema = new mongoose.Schema({
  message: String,
  level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' }
}, { timestamps: true })

const Task = mongoose.model('Task', taskSchema)
// Отдельная коллекция для архивных задач
const Archive = mongoose.model('Archive', taskSchema, 'archives')
const Group = mongoose.model('Group', groupSchema)
const Department = mongoose.model('Department', departmentSchema)
// Коллекция пользователей бота отличается от AuthUser и хранится отдельно
// Название коллекции меняем на `telegram_users`, чтобы избежать конфликтов
// с историческими индексами, которые могли остаться в `users`
const User = mongoose.model('User', userSchema, 'telegram_users')
const Log = mongoose.model('Log', logSchema)

module.exports = { Task, Archive, Group, User, Department, Log }
