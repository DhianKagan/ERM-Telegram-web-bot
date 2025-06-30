#!/usr/bin/env node
// Проверка доступности порта MongoDB и наличия переменной окружения
require('dotenv').config()
const net = require('net')

const url = process.env.MONGO_DATABASE_URL
if (!url) {
  console.error('Не задана переменная MONGO_DATABASE_URL')
  process.exit(1)
}

try {
  const { hostname, port } = new URL(url)
  const socket = net.connect({ host: hostname, port: Number(port) }, () => {
    console.log(`Порт ${port} на ${hostname} открыт`)
    socket.end()
  })
  socket.on('error', (err) => {
    console.error('Ошибка соединения:', err.message)
    process.exit(1)
  })
} catch (e) {
  console.error('Ошибка разбора URL:', e.message)
  process.exit(1)
}
