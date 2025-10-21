// Назначение: проверка права пользователя изменять задачу
// Основные модули: express, fs/promises, accessMask, tasks, service
import { Response, NextFunction } from 'express';
import { promises as fs } from 'fs';
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
  const controllerIds = new Set<number>();
  const primaryController = Number(task.controller_user_id);
  if (Number.isFinite(primaryController)) {
    controllerIds.add(primaryController);
  }
  if (Array.isArray(task.controllers)) {
    task.controllers
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
      .forEach((value) => controllerIds.add(value));
  }
  const status =
    typeof task.status === 'string' ? (task.status as TaskInfo['status']) : undefined;
  const isTaskNew = !status || status === 'Новая';
  const hasTaskStarted = status !== undefined && status !== 'Новая';
  const isCreator = Number.isFinite(id) && task.created_by === id;
  const isExecutor = Number.isFinite(id) && assignedIds.has(id);
  const isController = Number.isFinite(id) && controllerIds.has(id);
  const sameActor = isCreator && isExecutor;
  const method = req.method.toUpperCase();
  const routePath = typeof req.route?.path === 'string' ? req.route.path : '';
  const isTaskUpdateRoute = method === 'PATCH' && routePath === '/:id';
  const isStatusRoute =
    method === 'PATCH' &&
    (routePath === '/:id/status' || req.originalUrl.endsWith('/status'));
  if (hasElevatedAccess || isController) {
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
    if (isCreator) {
      if (!(sameActor && hasTaskStarted)) {
        req.task = task;
        next();
        return;
      }
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
  const filesRaw = req.files;
  if (Array.isArray(filesRaw)) {
    await Promise.all(
      filesRaw
        .map((file) => {
          if (!file || typeof file !== 'object') {
            return undefined;
          }
          const record = file as { path?: unknown };
          return typeof record.path === 'string'
            ? fs.unlink(record.path).catch(() => undefined)
            : undefined;
        })
        .filter(Boolean) as Promise<unknown>[],
    );
  }
  sendProblem(req, res, {
    type: 'about:blank',
    title: 'Доступ запрещён',
    status: 403,
    detail: 'Forbidden',
  });
}
