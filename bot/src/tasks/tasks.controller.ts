// Контроллер задач с использованием TasksService
// Основные модули: express-validator, services, wgLogEngine
import { Request, Response } from 'express';
import { handleValidation } from '../utils/validate';
import container from '../container';
import type TasksService from './tasks.service';
const service = container.resolve<TasksService>('TasksService');
import { writeLog } from '../services/service';
import { getUsersMap } from '../db/queries';
import type { RequestWithUser } from '../types/request';

interface Task {
  assignees?: number[];
  controllers?: number[];
  created_by?: number;
  _id?: string;
}

export const list = async (req: RequestWithUser, res: Response) => {
  const { page, limit, ...filters } = req.query;
  let tasks: Task[];
  if (req.user!.role === 'admin') {
    tasks = (await service.get(
      filters,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    )) as Task[];
  } else {
    tasks = (await service.mentioned(String(req.user!.id))) as Task[];
  }
  const ids = new Set<number>();
  tasks.forEach((t) => {
    (t.assignees || []).forEach((id: number) => ids.add(id));
    (t.controllers || []).forEach((id: number) => ids.add(id));
    if (t.created_by) ids.add(t.created_by);
  });
  const users = await getUsersMap(Array.from(ids));
  res.json({ tasks, users });
};

export const detail = async (req: Request, res: Response) => {
  const task = (await service.getById(req.params.id)) as Task | null;
  if (!task) return res.sendStatus(404);
  const ids = new Set<number>();
  (task.assignees || []).forEach((id: number) => ids.add(id));
  (task.controllers || []).forEach((id: number) => ids.add(id));
  if (task.created_by) ids.add(task.created_by);
  const users = await getUsersMap(Array.from(ids));
  res.json({ task, users });
};

export const create = [
  handleValidation,
    async (req: RequestWithUser<any, any, any, any>, res: Response) => {
      const task = await service.create(req.body);
      await writeLog(
        `Создана задача ${task._id} пользователем ${req.user!.id}/${req.user!.username}`,
      );
      res.status(201).json(task);
    },
  ];

export const update = [
  handleValidation,
    async (req: RequestWithUser<any, any, any, any>, res: Response) => {
      const task = await service.update(req.params.id, req.body);
      if (!task) return res.sendStatus(404);
      await writeLog(
        `Обновлена задача ${req.params.id} пользователем ${req.user!.id}/${req.user!.username}`,
      );
      res.json(task);
    },
  ];

export const addTime = [
  handleValidation,
    async (req: RequestWithUser<any, any, any, any>, res: Response) => {
      const task = await service.addTime(req.params.id, req.body.minutes);
      if (!task) return res.sendStatus(404);
      await writeLog(
        `Время по задаче ${req.params.id} +${req.body.minutes} пользователем ${req.user!.id}/${req.user!.username}`,
      );
      res.json(task);
    },
  ];

export const bulk = [
  handleValidation,
    async (req: RequestWithUser<any, any, any, any>, res: Response) => {
      await service.bulk(req.body.ids, { status: req.body.status });
      await writeLog(
        `Массовое изменение статусов пользователем ${req.user!.id}/${req.user!.username}`,
      );
      res.json({ status: 'ok' });
    },
  ];

export const mentioned = async (req: RequestWithUser, res: Response) => {
  const tasks = await service.mentioned(String(req.user!.id));
  res.json(tasks);
};

export const summary = async (req: Request, res: Response) => {
  res.json(await service.summary(req.query));
};

export const remove = async (req: RequestWithUser, res: Response) => {
  const task = await service.remove(req.params.id);
  if (!task) return res.sendStatus(404);
  await writeLog(
    `Удалена задача ${req.params.id} пользователем ${req.user!.id}/${req.user!.username}`,
  );
  res.sendStatus(204);
};
