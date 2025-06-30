#!/usr/bin/env node
// Оценка времени запуска с учётом повторных подключений
const attempts = Number(process.env.RETRY_ATTEMPTS || 3)
const delay = Number(process.env.RETRY_DELAY_MS || 5000)
const total = attempts * delay
console.log(`Всего ${attempts} попыток по ${delay} мс каждая.`)
console.log(`Дополнительное время старта: ${(total / 1000).toFixed(1)} сек.`)
console.log('Учтите, что каждое подключение создаёт новое соединение к MongoDB.')
