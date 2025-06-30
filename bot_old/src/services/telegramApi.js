// Сервис прямых вызовов Telegram Bot API. Модули: node.js fetch, config
const { botToken, botApiUrl } = require('../config')
const BASE = `${botApiUrl || 'https://api.telegram.org'}/bot${botToken}/`

async function call(method, params = {}) {
  const res = await fetch(BASE + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.description)
  return data.result
}

module.exports = { call }
