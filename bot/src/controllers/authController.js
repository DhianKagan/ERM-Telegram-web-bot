// Контроллер отправки и проверки кодов подтверждения.
// Модули: otp, auth, queries, userInfoService
const otp = require('../services/otp')
const { generateToken } = require('../auth/auth')
const { getUser, createUser } = require('../db/queries')
const { getMemberStatus } = require('../services/userInfoService')
const config = require('../config')

exports.sendCode = async (req, res) => {
  const { telegramId } = req.body
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' })
  const user = await getUser(telegramId)
  const roleId = user?.roleId?.toString()
  if (roleId === config.adminRoleId) {
    await otp.sendAdminCode({ telegramId })
  } else {
    await otp.sendCode({ telegramId })
  }
  res.json({ status: 'sent' })
}

exports.verifyCode = async (req, res) => {
  const { telegramId, code, username } = req.body
  const id = String(telegramId)
  if (!/^[0-9]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid telegramId' })
  }
  const user = await getUser(id)
  const roleId = user?.roleId?.toString()
  const verified =
    roleId === config.adminRoleId
      ? otp.verifyAdminCode({ telegramId: id, code })
      : otp.verifyCode({ telegramId: id, code })
  if (verified) {
    try {
      const status = await getMemberStatus(id)
      if (!['creator', 'administrator', 'member'].includes(status)) {
        return res.status(403).json({ error: 'not in group' })
      }
    } catch {
      return res.status(400).json({ error: 'member check failed' })
    }
    let u = user
    if (!u) u = await createUser(id, username, roleId || config.userRoleId)
    const role = roleId === config.adminRoleId ? 'admin' : 'user'
    const token = generateToken({ id, username: u.username, role })
    return res.json({ token })
  }
  res.status(400).json({ error: 'invalid code' })
}

exports.codes = otp.codes
exports.adminCodes = otp.adminCodes


