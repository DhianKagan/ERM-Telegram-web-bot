// Назначение: контроллер оптимизации маршрутов
// Основные модули: express-validator, services/optimizer
import { Response } from 'express';
import { validationResult } from 'express-validator';
import * as service from '../services/optimizer';
import { sendProblem } from '../utils/problem';
import type RequestWithUser from '../types/request';

type OptimizeRequestBody = {
  tasks?: unknown;
  count?: unknown;
  method?: service.OptimizeMethod;
};

const normalizeTasks = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((taskId) =>
      typeof taskId === 'string'
        ? taskId.trim()
        : taskId != null
          ? String(taskId)
          : '',
    )
    .filter((taskId): taskId is string => Boolean(taskId));
};

const normalizeCount = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export async function optimize(
  req: RequestWithUser<Record<string, string>, unknown, OptimizeRequestBody>,
  res: Response,
): Promise<void> {
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
  const tasks = normalizeTasks(req.body?.tasks);
  const count = normalizeCount(req.body?.count);
  const method = req.body?.method;
  const plan = await service.optimize(
    tasks,
    count ?? 1,
    method,
    Number.isFinite(actorId) ? (actorId as number) : undefined,
  );
  res.json({ plan });
}
