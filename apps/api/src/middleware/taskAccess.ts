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
  if (
    hasAccess(mask, ACCESS_ADMIN) ||
    hasAccess(mask, ACCESS_MANAGER) ||
    task.created_by === id ||
    task.assigned_user_id === id ||
    task.controller_user_id === id ||
    (Array.isArray(task.assignees) && task.assignees.includes(id)) ||
    (Array.isArray(task.controllers) && task.controllers.includes(id))
  ) {
    req.task = task;
    next();
    return;
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
