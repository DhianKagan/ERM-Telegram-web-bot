// Назначение файла: декоратор для установки требуемой маски доступа
// Основные модули: middleware
export const ROLES_KEY = Symbol('roles')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Roles(mask: any) {
  return function (req: any, _res: any, next: any) {
    req[ROLES_KEY] = mask
    return next()
  }
}

export default { Roles, ROLES_KEY }
