// Назначение: контроллер маршрутов: список с фильтрами
// Основные модули: express-validator, services/routes
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as service from '../services/routes';
import { sendProblem } from '../utils/problem';
import { sendCached } from '../utils/sendCached';

export async function all(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorList = errors.array();
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Ошибка валидации',
      status: 400,
      detail: 'Ошибка валидации',
      errors: errorList,
    });
    return;
  }
  const filters = {
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
  };
  const data = await service.list(filters);
  sendCached(req, res, data);
}
