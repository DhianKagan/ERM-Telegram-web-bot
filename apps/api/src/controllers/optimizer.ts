// Назначение: контроллер оптимизации маршрутов
// Основные модули: express-validator, services/optimizer
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as service from '../services/optimizer';
import { sendProblem } from '../utils/problem';

export async function optimize(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Ошибка валидации',
      status: 400,
      detail: JSON.stringify(errors.array()),
    });
    return;
  }
  const routes = await service.optimize(
    (req.body.tasks as string[]) || [],
    req.body.count,
    req.body.method,
  );
  res.json({ routes });
}
