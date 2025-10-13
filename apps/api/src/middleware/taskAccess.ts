// Назначение: проверка права пользователя изменять задачу
// Основные модули: express, accessMask, tasks, service
import { Response, NextFunction } from 'express';
import {
  hasAccess,
  ACCESS_ADMIN,
  ACCESS_USER,
  ACCESS_MANAGER,
} from '../utils/accessMask';
import * as service from '../services/tasks';
import { writeLog } from '../services/service';
import type { RequestWithUser, TaskInfo } from '../types/request';
import { sendProblem } from '../utils/problem';

export default async function checkTaskAccess(
  req: RequestWithUser,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const task = (await service.getById(req.params.id)) as TaskInfo | null;
  if (!task) {
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Задача не найдена',
      status: 404,
      detail: 'Not Found',
    });
    return;
  }
  const mask = req.user?.access ?? ACCESS_USER;
  const id = Number(req.user?.id);
  const hasElevatedAccess =
    hasAccess(mask, ACCESS_ADMIN) || hasAccess(mask, ACCESS_MANAGER);
  const assignedIds = new Set<number>();
  if (typeof task.assigned_user_id === 'number') {
    assignedIds.add(task.assigned_user_id);
  }
  if (Array.isArray(task.assignees)) {
    task.assignees
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
      .forEach((value) => assignedIds.add(value));
  }
  const isCreator = Number.isFinite(id) && task.created_by === id;
  const isExecutor = Number.isFinite(id) && assignedIds.has(id);
  const sameActor = isCreator && isExecutor;
  const status = typeof task.status === 'string' ? task.status : undefined;
  const isTaskNew = status === 'Новая';
  const method = req.method.toUpperCase();
  const routePath = typeof req.route?.path === 'string' ? req.route.path : '';
  const isTaskUpdateRoute = method === 'PATCH' && routePath === '/:id';
  const isStatusRoute =
    method === 'PATCH' &&
    (routePath === '/:id/status' || req.originalUrl.endsWith('/status'));
  if (hasElevatedAccess) {
    req.task = task;
    next();
    return;
  }
  if (isTaskUpdateRoute) {
    if (isCreator && isTaskNew) {
      req.task = task;
      next();
      return;
    }
    if (sameActor && isTaskNew) {
      req.task = task;
      next();
      return;
    }
    if (isExecutor && !isCreator) {
      const payload = (req.body ?? {}) as Record<string, unknown>;
      const keys = Object.entries(payload)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key);
      const allowed = new Set(['status']);
      if (keys.every((key) => allowed.has(key))) {
        req.task = task;
        next();
        return;
      }
    }
  } else if (isStatusRoute) {
    if ((isCreator && isTaskNew) || (sameActor && isTaskNew)) {
      req.task = task;
      next();
      return;
    }
    if (isExecutor && !sameActor) {
      req.task = task;
      next();
      return;
    }
  }
  await writeLog(
    `Нет доступа ${req.method} ${req.originalUrl} user:${id}/${req.user?.username} ip:${req.ip}`,
  ).catch(() => {});
  sendProblem(req, res, {
    type: 'about:blank',
    title: 'Доступ запрещён',
    status: 403,
    detail: 'Forbidden',
  });
}
