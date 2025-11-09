// Назначение: контроллеры аналитики маршрутных планов.
// Основные модули: express, express-validator, services/routePlanAnalytics

import type { Request, Response } from 'express';
import type { RoutePlanStatus } from 'shared';
import { fetchRoutePlanAnalytics } from '../services/routePlanAnalytics';
import { sendProblem } from '../utils/problem';

const parseDate = (value: unknown): Date | undefined => {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  const candidate = new Date(value);
  if (Number.isNaN(candidate.getTime())) {
    return undefined;
  }
  return candidate;
};

const parseStatus = (value: unknown): RoutePlanStatus | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized === 'draft' || normalized === 'approved' || normalized === 'completed') {
    return normalized;
  }
  return undefined;
};

export async function routePlanSummary(req: Request, res: Response): Promise<void> {
  try {
    const result = await fetchRoutePlanAnalytics({
      from: parseDate(req.query.from),
      to: parseDate(req.query.to),
      status: parseStatus(req.query.status),
    });
    res.json(result);
  } catch (error) {
    console.error('Не удалось получить аналитику маршрутных планов', error);
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Ошибка аналитики',
      status: 500,
      detail: 'Не удалось рассчитать метрики маршрутных планов',
    });
  }
}

export default { routePlanSummary };
