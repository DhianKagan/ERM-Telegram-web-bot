// Контроллер отправки и проверки кодов подтверждения. Модули: telegramApi, gateway
const { call } = require('../services/telegramApi')
const { sendSms } = require('../services/gateway')

const codes = new Map()

exports.sendCode = async (req, res) => {
  const { phone, telegramId } = req.body
  if (!phone && !telegramId) return res.status(400).json({ error: 'phone or telegramId required' })
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const text = `Код подтверждения: ${code}`
  const key = phone || String(telegramId)
  codes.set(key, code)
  if (telegramId) {
    await call('sendMessage', { chat_id: telegramId, text })
  } else {
    await sendSms(phone, text)
  }
  res.json({ status: 'sent' })
}

exports.verifyCode = (req, res) => {
  const { phone, telegramId, code } = req.body
  const key = phone || String(telegramId)
  if (codes.get(key) === code) {
    codes.delete(key)
    return res.json({ status: 'verified' })
  }
  res.status(400).json({ error: 'invalid code' })
}
