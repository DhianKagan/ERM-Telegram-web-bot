// Назначение: проверка роли или маски доступа
// Основные модули: express, accessMask, service
import { Response, NextFunction } from 'express';
import { hasAccess, ACCESS_USER } from '../utils/accessMask';
import { writeLog } from '../services/service';
import type { RequestWithUser } from '../types/request';
import { sendProblem } from '../utils/problem';

type Expected = number | string | string[];

export default function checkRole(expected: Expected) {
  return (req: RequestWithUser, res: Response, next: NextFunction): void => {
    const role = req.user?.role || 'user';
    const mask = req.user?.access ?? ACCESS_USER;
    if (typeof expected === 'number') {
      if (hasAccess(mask, expected)) return next();
    } else {
      const allowed = Array.isArray(expected) ? expected : [expected];
      if (allowed.includes(role)) return next();
    }
    writeLog(
      `Недостаточно прав ${req.method} ${req.originalUrl} user:${req.user?.id}/${req.user?.username} ip:${req.ip}`,
    ).catch(() => {});
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Доступ запрещён',
      status: 403,
      detail: 'Forbidden',
    });
  };
}
