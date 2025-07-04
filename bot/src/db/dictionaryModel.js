// Модели справочников с массивами значений
const mongoose = require('mongoose')
const connect = require('./connection')

if (process.env.NODE_ENV !== 'test') {
  connect().catch(e => {
    console.error('Не удалось подключиться к MongoDB:', e.message)
    process.exit(1)
  })
}

const defaultValueSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  values: [String]
})

const transportSchema = new mongoose.Schema({
  name: String,
  specs: [String],
  numbers: [String]
})

const DefaultValue = mongoose.model('DefaultValue', defaultValueSchema)
const Transport = mongoose.model('Transport', transportSchema)

module.exports = { DefaultValue, Transport }
