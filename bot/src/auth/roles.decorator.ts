// Назначение файла: декоратор для установки требуемой маски доступа
// Основные модули: middleware
export const ROLES_KEY = Symbol('roles')

export function Roles(mask) {
  return function (req, _res, next) {
    req[ROLES_KEY] = mask
    return next()
  }
}

export default { Roles, ROLES_KEY }
