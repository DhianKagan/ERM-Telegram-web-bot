// Назначение: контроллер маршрутов: список с фильтрами
// Модули: express-validator, services/routes
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as service from '../services/routes';

export async function all(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  const filters = {
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    status:
      typeof req.query.status === 'string' ? req.query.status : undefined,
  };
  res.json(await service.list(filters));
}

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(module as any).exports = { all };
