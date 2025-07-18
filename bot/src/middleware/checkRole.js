// Middleware для проверки роли или маски доступа
const { hasAccess, ACCESS_USER } = require('../utils/accessMask');

module.exports = (expected) => (req, res, next) => {
  const role = req.user?.role || 'user';
  const mask = req.user?.access || ACCESS_USER;
  if (typeof expected === 'number') {
    if (hasAccess(mask, expected)) return next();
  } else {
    const allowed = Array.isArray(expected) ? expected : [expected];
    if (allowed.includes(role)) return next();
  }
  return res.status(403).json({ message: 'Forbidden' });
};
