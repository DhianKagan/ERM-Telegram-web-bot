// Назначение файла: guard проверки initData мини-приложения
// Основные модули: verifyInitData
import type { Request, Response, NextFunction } from 'express';
import verifyInitData from '../utils/verifyInitData';
import { sendProblem } from '../utils/problem';

export default function tmaAuthGuard(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const auth = req.headers.authorization;
  let raw: string | null = null;
  if (auth && auth.startsWith('tma ')) {
    raw = auth.slice(4).trim();
  } else if (req.headers['x-telegram-init-data']) {
    raw = String(req.headers['x-telegram-init-data']);
  }
  if (!raw) {
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Ошибка авторизации',
      status: 401,
      detail: 'invalid init data',
    });
    return;
  }
  try {
    res.locals.initData = verifyInitData(raw);
  } catch {
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Ошибка авторизации',
      status: 401,
      detail: 'invalid init data',
    });
    return;
  }
  next();
}
