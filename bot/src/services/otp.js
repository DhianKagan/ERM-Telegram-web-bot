// Сервис генерации и проверки одноразовых кодов.
// Модули: telegramApi, gateway
const { call } = require('./telegramApi')
const { sendSms } = require('./gateway')

const codes = new Map()
const attempts = new Map()
const EXPIRATION_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5

function clean() {
  const now = Date.now()
  for (const [key, value] of codes) {
    if (now - value.ts > EXPIRATION_MS) codes.delete(key)
  }
  for (const [key, value] of attempts) {
    if (now - value.ts > EXPIRATION_MS) attempts.delete(key)
  }
}

setInterval(clean, EXPIRATION_MS).unref()

async function sendCode({ phone, telegramId }) {
  clean()
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const text = `Код подтверждения: ${code}`
  const key = phone || String(telegramId)
  codes.set(key, { code, ts: Date.now() })
  attempts.delete(key)
  if (telegramId) {
    await call('sendMessage', { chat_id: telegramId, text })
  } else {
    await sendSms(phone, text)
  }
}

function verifyCode({ phone, telegramId, code }) {
  clean()
  const key = phone || String(telegramId)
  const entry = codes.get(key)
  const info = attempts.get(key) || { count: 0, ts: Date.now() }
  if (entry && info.count < MAX_ATTEMPTS && entry.code === code && Date.now() - entry.ts <= EXPIRATION_MS) {
    codes.delete(key)
    attempts.delete(key)
    return true
  }
  info.count += 1
  info.ts = Date.now()
  attempts.set(key, info)
  if (info.count >= MAX_ATTEMPTS) codes.delete(key)
  return false
}

module.exports = { sendCode, verifyCode, codes, attempts }
