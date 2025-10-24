// Назначение: контроллер оптимизации маршрутов
// Основные модули: express-validator, services/optimizer
import { Response } from 'express';
import { validationResult } from 'express-validator';
import * as service from '../services/optimizer';
import { sendProblem } from '../utils/problem';
import type RequestWithUser from '../types/request';

export async function optimize(req: RequestWithUser, res: Response): Promise<void> {
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
  const actorIdRaw = req.user?.id;
  const actorId =
    typeof actorIdRaw === 'number' && Number.isFinite(actorIdRaw)
      ? actorIdRaw
      : typeof actorIdRaw === 'string' && actorIdRaw.trim()
      ? Number(actorIdRaw)
      : undefined;
  const plan = await service.optimize(
    (req.body.tasks as string[]) || [],
    req.body.count,
    req.body.method,
    Number.isFinite(actorId) ? (actorId as number) : undefined,
  );
  res.json({ plan });
}
