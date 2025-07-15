// Контроллер отправки и проверки кодов подтверждения.
// Модули: otp, auth, queries, userInfoService
const otp = require('../services/otp')
const { generateToken } = require('../auth/auth')
const { getUser, createUser } = require('../db/queries')
const { getMemberStatus } = require('../services/userInfoService')

exports.sendCode = async (req, res) => {
  const { telegramId } = req.body
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' })
  await otp.sendCode({ telegramId })
  res.json({ status: 'sent' })
}

exports.verifyCode = async (req, res) => {
  const { telegramId, code, username } = req.body
  const id = String(telegramId)
  if (!/^[0-9]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid telegramId' })
  }
  if (otp.verifyCode({ telegramId: id, code })) {
    try {
      const status = await getMemberStatus(id)
      if (!['creator', 'administrator', 'member'].includes(status)) {
        return res.status(403).json({ error: 'not in group' })
      }
    } catch {
      return res.status(400).json({ error: 'member check failed' })
    }
    let user = await getUser(id)
    if (!user) user = await createUser(id, username)
    const role = user.role || 'user'
    const token = generateToken({ id, username: user.username, role })
    return res.json({ token })
  }
  res.status(400).json({ error: 'invalid code' })
}

exports.codes = otp.codes

exports.sendAdminCode = async (req, res) => {
  const { telegramId } = req.body
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' })
  await otp.sendAdminCode({ telegramId })
  res.json({ status: 'sent' })
}

exports.verifyAdminCode = async (req, res) => {
  const { telegramId, code, username } = req.body
  const id = String(telegramId)
  if (!/^[0-9]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid telegramId' })
  }
  if (otp.verifyAdminCode({ telegramId: id, code })) {
    let user = await getUser(id)
    if (!user) user = await createUser(id, username, 'admin')
    const role = user.role || 'user'
    const token = generateToken({ id, username: user.username, role })
    return res.json({ token })
  }
  res.status(400).json({ error: 'invalid code' })
}

