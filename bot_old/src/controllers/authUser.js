// Контроллер личного кабинета и входа через Telegram
const { getUser, createUser } = require('../db/queries')
const crypto = require('crypto')
const { botToken } = require('../config')
const { verifyAdmin, generateToken } = require('../auth/auth')

function checkTelegramData(data) {
  const hash = data.hash
  const authData = { ...data }
  delete authData.hash
  const secret = crypto
    .createHash('sha256')
    .update(botToken)
    .digest()
  const dataCheckString = Object.keys(authData)
    .sort()
    .map(k => `${k}=${authData[k]}`)
    .join('\n')
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(dataCheckString)
    .digest('hex')
  return hmac === hash && Date.now() / 1000 - data.auth_date < 86400
}

exports.profile = async (req, res) => {
  const user = await getUser(req.user.id)
  if (!user) return res.sendStatus(404)
  res.json(user)
}

exports.telegramLogin = async (req, res) => {
  if (!checkTelegramData(req.body)) {
    return res.status(401).json({ error: 'Invalid telegram data' })
  }
  const { id, username } = req.body
  let user = await getUser(id)
  if (!user) {
    user = await createUser(id, username)
  }
  const isAdmin = await verifyAdmin(id)
  const token = generateToken({ id, username, isAdmin })
  res.json({ token })
}
