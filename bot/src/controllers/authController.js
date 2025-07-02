// Контроллер отправки и проверки кодов подтверждения. Модули: otp, auth, queries
const otp = require('../services/otp')
const { generateToken, verifyAdmin } = require('../auth/auth')
const { getUser, createUser, getUserByUsername } = require('../db/queries')

exports.sendCode = async (req, res) => {
  const { phone, telegramId } = req.body
  if (!phone && !telegramId) return res.status(400).json({ error: 'phone or telegramId required' })
  await otp.sendCode({ phone, telegramId })
  res.json({ status: 'sent' })
}

exports.verifyCode = async (req, res) => {
  const { phone, telegramId, code, username } = req.body
  if (otp.verifyCode({ phone, telegramId, code })) {
    const id = telegramId
    let user = await getUser(id)
    if (!user) user = await createUser(id, username)
    const isAdmin = await verifyAdmin(id)
    const token = generateToken({ id, username: user.username, isAdmin })
    return res.json({ token })
  }
  res.status(400).json({ error: 'invalid code' })
}

exports.codes = otp.codes

exports.loginByUsername = async (req, res) => {
  const { username } = req.body
  const user = await getUserByUsername(username)
  if (!user) return res.status(404).json({ error: 'not found' })
  const isAdmin = await verifyAdmin(user.telegram_id)
  const token = generateToken({ id: user.telegram_id, username: user.username, isAdmin })
  res.json({ token })
}
