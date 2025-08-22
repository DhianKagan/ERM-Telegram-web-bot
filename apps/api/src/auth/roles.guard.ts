// Назначение файла: guard для проверки маски доступа пользователя
// Основные модули: utils/accessMask, services/service
import { hasAccess, ACCESS_USER } from '../utils/accessMask';
import { writeLog } from '../services/service';
import { ROLES_KEY } from './roles.decorator';
import type { RequestWithUser } from '../types/request';
import { Response, NextFunction } from 'express';
import { sendProblem } from '../utils/problem';

export default function rolesGuard(
  req: RequestWithUser,
  res: Response,
  next: NextFunction,
) {
  const required = (req as unknown as Record<string | symbol, unknown>)[
    ROLES_KEY
  ] as number | undefined;
  if (!required) return next();
  const mask = req.user?.access || ACCESS_USER;
  if (hasAccess(mask, required)) return next();
  writeLog(
    `Недостаточно прав ${req.method} ${req.originalUrl} user:${req.user?.id}/${req.user?.username} ip:${req.ip}`,
  ).catch(() => {});
  sendProblem(req, res, {
    type: 'about:blank',
    title: 'Доступ запрещён',
    status: 403,
    detail: 'Forbidden',
  });
}
