// Назначение файла: декоратор для установки требуемой маски доступа
// Основные модули: middleware
const ROLES_KEY = Symbol('roles')

function Roles(mask) {
  return function (req, _res, next) {
    req[ROLES_KEY] = mask
    return next()
  }
}

module.exports = { Roles, ROLES_KEY }
