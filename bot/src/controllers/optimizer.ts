// Назначение: контроллер оптимизации маршрутов
// Модули: express-validator, services/optimizer
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as service from '../services/optimizer';

export async function optimize(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  const routes = await service.optimize(
    (req.body.tasks as string[]) || [],
    req.body.count,
    req.body.method,
  );
  res.json({ routes });
}

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(module as any).exports = { optimize };
