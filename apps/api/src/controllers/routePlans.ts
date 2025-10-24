// Назначение: контроллеры для маршрутных планов.
// Основные модули: express-validator, services/routePlans

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import type { RoutePlanStatus } from 'shared';
import {
  listPlans,
  getPlan,
  updatePlan,
  updatePlanStatus,
  removePlan,
  type RoutePlanUpdatePayload,
  type RoutePlanRouteInput,
} from '../services/routePlans';
import type RequestWithUser from '../types/request';
import { sendProblem } from '../utils/problem';

const parseActorId = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export async function list(req: Request, res: Response): Promise<void> {
  const { status, page, limit } = req.query;
  const filters = {
    status:
      typeof status === 'string' && status.trim()
        ? (status.trim() as RoutePlanStatus)
        : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  };
  const result = await listPlans(filters);
  res.json(result);
}

export async function detail(req: Request, res: Response): Promise<void> {
  const plan = await getPlan(req.params.id);
  if (!plan) {
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Маршрутный план не найден',
      status: 404,
      detail: 'Маршрутный план не найден',
    });
    return;
  }
  res.json({ plan });
}

const normalizeRoutesPayload = (routes: unknown): RoutePlanUpdatePayload['routes'] => {
  if (!Array.isArray(routes)) return undefined;
  return routes
    .map((route) => {
      if (!route || typeof route !== 'object') return null;
      const data = route as Record<string, unknown>;
      const rawDriverId = data.driverId;
      let driverId: number | string | null | undefined;
      if (rawDriverId === null) {
        driverId = null;
      } else if (typeof rawDriverId === 'number' && Number.isFinite(rawDriverId)) {
        driverId = Number(rawDriverId);
      } else if (typeof rawDriverId === 'string') {
        const trimmed = rawDriverId.trim();
        driverId = trimmed ? trimmed : undefined;
      }
      const notesRaw = data.notes;
      const normalized: RoutePlanRouteInput = {
        id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : undefined,
        order:
          typeof data.order === 'number' && Number.isFinite(data.order)
            ? Number(data.order)
            : undefined,
        vehicleId:
          data.vehicleId === null
            ? null
            : typeof data.vehicleId === 'string' && data.vehicleId.trim()
            ? data.vehicleId.trim()
            : undefined,
        vehicleName:
          typeof data.vehicleName === 'string' && data.vehicleName.trim()
            ? data.vehicleName.trim()
            : undefined,
        driverId,
        driverName:
          typeof data.driverName === 'string' && data.driverName.trim()
            ? data.driverName.trim()
            : undefined,
        notes:
          notesRaw === null
            ? null
            : typeof notesRaw === 'string' && notesRaw.trim()
            ? notesRaw.trim()
            : undefined,
        tasks: Array.isArray(data.tasks)
          ? data.tasks.map((taskId) => String(taskId)).filter((taskId) => !!taskId)
          : [],
      };
      return normalized;
    })
    .filter((route): route is RoutePlanRouteInput => Boolean(route));
};

export async function update(
  req: RequestWithUser,
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

  const payload: RoutePlanUpdatePayload = {
    title: typeof req.body.title === 'string' ? req.body.title : undefined,
    notes:
      req.body.notes === null || typeof req.body.notes === 'string'
        ? req.body.notes
        : undefined,
    routes: normalizeRoutesPayload(req.body.routes),
  };

  const plan = await updatePlan(req.params.id, payload);
  if (!plan) {
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Маршрутный план не найден',
      status: 404,
      detail: 'Маршрутный план не найден',
    });
    return;
  }
  res.json({ plan });
}

export async function changeStatus(
  req: RequestWithUser,
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
  const status = req.body.status as RoutePlanStatus;
  const actorId = parseActorId(req.user?.id);
  const plan = await updatePlanStatus(req.params.id, status, actorId);
  if (!plan) {
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Маршрутный план не найден',
      status: 404,
      detail: 'Маршрутный план не найден',
    });
    return;
  }
  res.json({ plan });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const deleted = await removePlan(req.params.id);
  if (!deleted) {
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Маршрутный план не найден',
      status: 404,
      detail: 'Маршрутный план не найден',
    });
    return;
  }
  res.status(204).send();
}

export default {
  list,
  detail,
  update,
  changeStatus,
  remove,
};
