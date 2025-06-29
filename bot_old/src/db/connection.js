// Управление подключением к MongoDB с пулом соединений
// Модули: mongoose, config
const mongoose = require('mongoose')
const { mongoUrl } = require('../config')

// Для версии mongoose 8 опции useNewUrlParser и useUnifiedTopology
// больше не требуются, оставляем только размер пула
const opts = { maxPoolSize: 10 }
let connecting

module.exports = async function connect() {
  if (mongoose.connection.readyState === 1) return mongoose.connection
  if (!connecting) connecting = mongoose.connect(mongoUrl, opts)
  return connecting
}
