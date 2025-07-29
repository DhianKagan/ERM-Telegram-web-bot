// Назначение файла: guard для проверки маски доступа пользователя
// Основные модули: utils/accessMask
const { hasAccess, ACCESS_USER } = require('../utils/accessMask')
const { writeLog } = require('../services/service')
// Для корректного импорта указываем расширение .ts
const { ROLES_KEY } = require('./roles.decorator.ts')

function rolesGuard(req, res, next) {
  const required = req[ROLES_KEY]
  if (!required) return next()
  const mask = req.user?.access || ACCESS_USER
  if (hasAccess(mask, required)) return next()
  writeLog(
    `Недостаточно прав ${req.method} ${req.originalUrl} user:${req.user.id}/${req.user.username} ip:${req.ip}`,
  ).catch(() => {})
  return res.status(403).json({ message: 'Forbidden' })
}

module.exports = rolesGuard
