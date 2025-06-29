// Контроллер отправки и проверки кодов подтверждения. Модули: telegramApi, gateway
const { call } = require('../services/telegramApi')
const { sendSms } = require('../services/gateway')

const codes = new Map()
const EXPIRATION_MS = 5 * 60 * 1000

function clean() {
  const now = Date.now()
  for (const [key, value] of codes) {
    if (now - value.ts > EXPIRATION_MS) codes.delete(key)
  }
}

setInterval(clean, EXPIRATION_MS).unref()

exports.sendCode = async (req, res) => {
  clean()
  const { phone, telegramId } = req.body
  if (!phone && !telegramId) return res.status(400).json({ error: 'phone or telegramId required' })
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const text = `Код подтверждения: ${code}`
  const key = phone || String(telegramId)
  codes.set(key, { code, ts: Date.now() })
  if (telegramId) {
    await call('sendMessage', { chat_id: telegramId, text })
  } else {
    await sendSms(phone, text)
  }
  res.json({ status: 'sent' })
}

exports.verifyCode = (req, res) => {
  clean()
  const { phone, telegramId, code } = req.body
  const key = phone || String(telegramId)
  const entry = codes.get(key)
  if (entry && entry.code === code && Date.now() - entry.ts <= EXPIRATION_MS) {
    codes.delete(key)
    return res.json({ status: 'verified' })
  }
  res.status(400).json({ error: 'invalid code' })
}

exports.codes = codes
