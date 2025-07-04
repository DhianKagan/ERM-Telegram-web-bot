// Модель универсальной заявки со сложной структурой полей
const mongoose = require('mongoose')
const connect = require('./connection')

if (process.env.NODE_ENV !== 'test') {
  connect().catch(e => {
    console.error('Не удалось подключиться к MongoDB:', e.message)
    process.exit(1)
  })
}

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
  transport: String
}, { _id: false })

const itemSchema = new mongoose.Schema({
  name: String,
  quantity: Number,
  cost: Number
}, { _id: false })

const procurementSchema = new mongoose.Schema({
  items: [itemSchema],
  vendor: String,
  total_cost: Number
}, { _id: false })

const workSchema = new mongoose.Schema({
  description: String,
  deadline: Date,
  performers: [Number]
}, { _id: false })

const universalTaskSchema = new mongoose.Schema({
  request_id: String,
  submission_date: Date,
  applicant: applicantSchema,
  logistics_details: logisticsSchema,
  procurement_details: procurementSchema,
  work_details: workSchema,
  custom_fields: mongoose.Schema.Types.Mixed
}, { timestamps: true })

module.exports = mongoose.model('UniversalTask', universalTaskSchema)
