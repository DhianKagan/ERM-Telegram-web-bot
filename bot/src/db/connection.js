// Управление подключением к MongoDB с пулом соединений и резервным URL
// Модули: mongoose, config
const mongoose = require('mongoose')
const { mongoUrl } = require('../config')
const backupUrl = process.env.MONGO_BACKUP_URL

// Для версии mongoose 8 опции useNewUrlParser и useUnifiedTopology
// больше не требуются, оставляем только размер пула
const opts = { maxPoolSize: 10 }
let connecting

mongoose.connection.on('disconnected', async () => {
  console.error('Соединение с MongoDB прервано')
  if (backupUrl && mongoUrl !== backupUrl) {
    try {
      await mongoose.connect(backupUrl, opts)
      console.log('Подключились к резервной базе')
    } catch (e) {
      console.error('Ошибка подключения к резервной базе:', e.message)
    }
  }
})
mongoose.connection.on('error', e => {
  console.error('Ошибка MongoDB:', e.message)
})

module.exports = async function connect() {
  if (mongoose.connection.readyState === 1) return mongoose.connection
  if (!connecting) connecting = mongoose.connect(mongoUrl, opts)
  return connecting
}
