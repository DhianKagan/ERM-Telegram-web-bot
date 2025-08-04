// Назначение: проверка права пользователя изменять задачу
// Основные модули: express, accessMask, tasks, service
import { Response, NextFunction } from 'express';
import { hasAccess, ACCESS_ADMIN, ACCESS_USER } from '../utils/accessMask';
import * as service from '../services/tasks';
import { writeLog } from '../services/service';

interface UserInfo {
  id?: number;
  username?: string;
  access?: number;
}

interface TaskInfo {
  created_by?: number;
  assigned_user_id?: number;
  controller_user_id?: number;
  assignees?: number[];
  controllers?: number[];
}

interface RequestWithUser {
  method: string;
  originalUrl: string;
  ip: string;
  params: Record<string, string>;
  user?: UserInfo;
  task?: TaskInfo;
}

export default async function checkTaskAccess(
  req: RequestWithUser,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const task = (await service.getById(req.params.id)) as TaskInfo | null;
  if (!task) {
    res.sendStatus(404);
    return;
  }
  const mask = req.user?.access ?? ACCESS_USER;
  const id = Number(req.user?.id);
  if (
    hasAccess(mask, ACCESS_ADMIN) ||
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
  res.status(403).json({ message: 'Forbidden' });
}
