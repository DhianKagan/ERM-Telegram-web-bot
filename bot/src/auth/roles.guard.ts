// Назначение файла: guard для проверки маски доступа пользователя
// Основные модули: utils/accessMask
import { hasAccess, ACCESS_USER } from '../utils/accessMask.js'
import { writeLog } from '../services/service.js'
// Для корректного импорта указываем расширение .ts
const { ROLES_KEY } = require('./roles.decorator.ts')

export default function rolesGuard(req, res, next) {
  const required = req[ROLES_KEY]
  if (!required) return next()
  const mask = req.user?.access || ACCESS_USER
  if (hasAccess(mask, required)) return next()
  writeLog(
    `Недостаточно прав ${req.method} ${req.originalUrl} user:${req.user.id}/${req.user.username} ip:${req.ip}`,
  ).catch(() => {})
  return res.status(403).json({ message: 'Forbidden' })
}
