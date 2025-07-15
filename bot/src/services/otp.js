// Сервис генерации и проверки одноразовых кодов.
// Модули: telegramApi
const { call } = require('./telegramApi')

const codes = new Map()
const attempts = new Map()
const adminCodes = new Map()
const adminAttempts = new Map()
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
  for (const [key, value] of adminCodes) {
    if (now - value.ts > EXPIRATION_MS) adminCodes.delete(key)
  }
  for (const [key, value] of adminAttempts) {
    if (now - value.ts > EXPIRATION_MS) adminAttempts.delete(key)
  }
}

setInterval(clean, EXPIRATION_MS).unref()

async function sendCode({ telegramId }) {
  clean()
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const text = `Код подтверждения: ${code}`
  const key = String(telegramId)
  codes.set(key, { code, ts: Date.now() })
  attempts.delete(key)
  await call('sendMessage', { chat_id: telegramId, text })
}

async function sendAdminCode({ telegramId }) {
  clean()
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const text = `Код админа: ${code}`
  const key = String(telegramId)
  adminCodes.set(key, { code, ts: Date.now() })
  adminAttempts.delete(key)
  await call('sendMessage', { chat_id: telegramId, text })
}

function verifyCode({ telegramId, code }) {
  clean()
  const key = String(telegramId)
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

function verifyAdminCode({ telegramId, code }) {
  clean()
  const key = String(telegramId)
  const entry = adminCodes.get(key)
  const info = adminAttempts.get(key) || { count: 0, ts: Date.now() }
  if (entry && info.count < MAX_ATTEMPTS && entry.code === code && Date.now() - entry.ts <= EXPIRATION_MS) {
    adminCodes.delete(key)
    adminAttempts.delete(key)
    return true
  }
  info.count += 1
  info.ts = Date.now()
  adminAttempts.set(key, info)
  if (info.count >= MAX_ATTEMPTS) adminCodes.delete(key)
  return false
}

module.exports = {
  sendCode,
  verifyCode,
  codes,
  attempts,
  sendAdminCode,
  verifyAdminCode,
  adminCodes,
  adminAttempts
}
