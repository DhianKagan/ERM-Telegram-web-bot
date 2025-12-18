// Назначение: проверка права пользователя изменять задачу
// Основные модули: express, fs/promises, accessMask, tasks, service
import { Response, NextFunction } from 'express';
import { promises as fs } from 'fs';
import {
  hasAccess,
  ACCESS_ADMIN,
  ACCESS_USER,
  ACCESS_MANAGER,
  ACCESS_TASK_DELETE,
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
  const mask = Number(req.user?.access ?? ACCESS_USER);
  const roleName = typeof req.user?.role === 'string' ? req.user.role : '';
  const id = Number(req.user?.id);
  const hasDeleteAccess = hasAccess(mask, ACCESS_TASK_DELETE);
  const hasAdminAccess =
    roleName === 'admin' || hasAccess(mask, ACCESS_ADMIN) || hasDeleteAccess;
  const hasManagerAccess = hasAccess(mask, ACCESS_MANAGER) || hasDeleteAccess;
  const isAdminWithoutDelete = hasAdminAccess && !hasDeleteAccess;
  const isManagerActor = hasManagerAccess && !hasDeleteAccess;
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
    typeof task.status === 'string'
      ? (task.status as TaskInfo['status'])
      : undefined;
  const isTerminal = status === 'Выполнена' || status === 'Отменена';
  const isCreator = Number.isFinite(id) && task.created_by === id;
  const isExecutor = Number.isFinite(id) && assignedIds.has(id);
  const isController = Number.isFinite(id) && controllerIds.has(id);
  const method = req.method.toUpperCase();
  const routePath = typeof req.route?.path === 'string' ? req.route.path : '';
  const isTaskUpdateRoute = method === 'PATCH' && routePath === '/:id';
  const isStatusRoute =
    method === 'PATCH' &&
    (routePath === '/:id/status' || req.originalUrl.endsWith('/status'));
  const isActorLinked = isCreator || isExecutor || isController;
  const payload = (req.body ?? {}) as Record<string, unknown>;
  const payloadKeys = Object.entries(payload)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
  const nextStatus =
    typeof payload.status === 'string'
      ? (payload.status as TaskInfo['status'])
      : undefined;
  const isUserStatusAllowed = (() => {
    if (!isActorLinked || !nextStatus) return false;
    if (isTerminal) return false;
    if (!status || status === 'Новая') {
      return nextStatus === 'В работе' || nextStatus === 'Выполнена';
    }
    if (status === 'В работе') {
      return nextStatus === 'Выполнена' || nextStatus === 'В работе';
    }
    return false;
  })();
  if (hasDeleteAccess) {
    req.task = task;
    next();
    return;
  }
  if (isTaskUpdateRoute) {
    if (isAdminWithoutDelete && !isTerminal) {
      req.task = task;
      next();
      return;
    }
    if (isManagerActor && isActorLinked && !isTerminal) {
      req.task = task;
      next();
      return;
    }
    if (
      isUserStatusAllowed &&
      payloadKeys.length === 1 &&
      payloadKeys[0] === 'status'
    ) {
      req.task = task;
      next();
      return;
    }
  } else if (isStatusRoute) {
    if (isAdminWithoutDelete && !isTerminal) {
      req.task = task;
      next();
      return;
    }
    if (isManagerActor && isActorLinked && !isTerminal) {
      req.task = task;
      next();
      return;
    }
    if (isUserStatusAllowed) {
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
