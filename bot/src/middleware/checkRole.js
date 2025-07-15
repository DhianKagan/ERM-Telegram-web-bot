// Middleware для проверки роли пользователя
module.exports = expected => (req, res, next) => {
  const role = req.user?.role || 'user'
  const allowed = Array.isArray(expected) ? expected : [expected]
  if (allowed.includes(role)) return next()
  return res.status(403).json({ message: 'Forbidden' })
}
