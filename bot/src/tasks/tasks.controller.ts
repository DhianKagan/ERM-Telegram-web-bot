// Контроллер задач с использованием TasksService
// Основные модули: express-validator, services, wgLogEngine
// @ts-nocheck
import { handleValidation } from '../utils/validate.js';
import container from '../container';
const service = /** @type {any} */ (container.resolve('TasksService'));
import { writeLog } from '../services/service.js';
import { getUsersMap } from '../db/queries.js';

export const list = async (req, res) => {
  const { page, limit, ...filters } = req.query;
  let tasks;
  if (req.user.role === 'admin') {
    tasks = await service.get(
      filters,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  } else {
    tasks = await service.mentioned(req.user.id);
  }
  const ids = new Set();
  tasks.forEach((t) => {
    (t.assignees || []).forEach((id) => ids.add(id));
    (t.controllers || []).forEach((id) => ids.add(id));
    if (t.created_by) ids.add(t.created_by);
  });
  const users = await getUsersMap(Array.from(ids));
  res.json({ tasks, users });
};

export const detail = async (req, res) => {
  const task = await service.getById(req.params.id);
  if (!task) return res.sendStatus(404);
  const ids = new Set();
  (task.assignees || []).forEach((id) => ids.add(id));
  (task.controllers || []).forEach((id) => ids.add(id));
  if (task.created_by) ids.add(task.created_by);
  const users = await getUsersMap(Array.from(ids));
  res.json({ task, users });
};

export const create = [
  handleValidation,
  async (req, res) => {
    const task = await service.create(req.body);
    await writeLog(
      `Создана задача ${task._id} пользователем ${req.user.id}/${req.user.username}`,
    );
    res.status(201).json(task);
  },
];

export const update = [
  handleValidation,
  async (req, res) => {
    const task = await service.update(req.params.id, req.body);
    if (!task) return res.sendStatus(404);
    await writeLog(
      `Обновлена задача ${req.params.id} пользователем ${req.user.id}/${req.user.username}`,
    );
    res.json(task);
  },
];

export const addTime = [
  handleValidation,
  async (req, res) => {
    const task = await service.addTime(req.params.id, req.body.minutes);
    if (!task) return res.sendStatus(404);
    await writeLog(
      `Время по задаче ${req.params.id} +${req.body.minutes} пользователем ${req.user.id}/${req.user.username}`,
    );
    res.json(task);
  },
];

export const bulk = [
  handleValidation,
  async (req, res) => {
    await service.bulk(req.body.ids, { status: req.body.status });
    await writeLog(
      `Массовое изменение статусов пользователем ${req.user.id}/${req.user.username}`,
    );
    res.json({ status: 'ok' });
  },
];

export const mentioned = async (req, res) => {
  const tasks = await service.mentioned(req.user.id);
  res.json(tasks);
};

export const summary = async (req, res) => {
  res.json(await service.summary(req.query));
};

export const remove = async (req, res) => {
  const task = await service.remove(req.params.id);
  if (!task) return res.sendStatus(404);
  await writeLog(
    `Удалена задача ${req.params.id} пользователем ${req.user.id}/${req.user.username}`,
  );
  res.sendStatus(204);
};
