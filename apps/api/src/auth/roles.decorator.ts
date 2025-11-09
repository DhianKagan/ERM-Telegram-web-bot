// Назначение файла: декоратор для установки требуемой маски доступа
// Основные модули: middleware
export const ROLES_KEY = Symbol('roles');

import { Request, Response, NextFunction } from 'express';

export function Roles(mask: number) {
  return function (req: Request, _res: Response, next: NextFunction) {
    (req as unknown as Record<string | symbol, unknown>)[ROLES_KEY] = mask;
    return next();
  };
}

export default { Roles, ROLES_KEY };
