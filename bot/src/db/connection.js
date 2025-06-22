// Управление подключением к MongoDB с пулом соединений
// Модули: mongoose, config
const mongoose = require('mongoose')
const { mongoUrl } = require('../config')

const opts = { maxPoolSize: 10, useNewUrlParser: true, useUnifiedTopology: true }
let connecting

module.exports = async function connect() {
  if (mongoose.connection.readyState === 1) return mongoose.connection
  if (!connecting) connecting = mongoose.connect(mongoUrl, opts)
  return connecting
}
