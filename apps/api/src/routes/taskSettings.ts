// Роуты управления настройками задач
// Основные модули: express, middleware, services/taskSettings, shared
import { Router } from 'express';
import { body, param } from 'express-validator';
import authMiddleware from '../middleware/auth';
import requireRole from '../middleware/requireRole';
import validate from '../utils/validate';
import {
  getTaskFieldSettings,
  getTaskTypeSettings,
  updateTaskFieldLabel,
  updateTaskTypeSettings,
  clearTaskSettingsCache,
  parseTopicLink,
} from '../services/taskSettings';
import { sendProblem } from '../utils/problem';
import type { TaskSettingsResponse } from 'shared';

const router = Router();
const base = [authMiddleware()];

router.get('/', ...base, async (req, res) => {
  const [fields, types] = await Promise.all([
    getTaskFieldSettings(),
    getTaskTypeSettings(),
  ]);
  const payload: TaskSettingsResponse = {
    fields,
    types: types.map((type) => ({
      name: type.name,
      label: type.label,
      defaultLabel: type.defaultLabel,
      tg_theme_url: type.tg_theme_url,
    })),
  };
  res.json(payload);
});

router.put(
  '/fields/:name',
  ...base,
  requireRole('admin'),
  ...validate([
    param('name').isString().trim().notEmpty(),
    body('label').isString().trim().notEmpty(),
  ]),
  async (req, res) => {
    const { name } = req.params as { name: string };
    const { label } = req.body as { label: string };
    await updateTaskFieldLabel(name, label);
    const fields = await getTaskFieldSettings();
    const field = fields.find((item) => item.name === name.trim());
    if (!field) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Не удалось обновить поле задачи',
        status: 500,
        detail: 'Настройка не найдена после обновления',
      });
      return;
    }
    res.json(field);
  },
);

router.put(
  '/types/:name',
  ...base,
  requireRole('admin'),
  ...validate([
    param('name').isString().trim().notEmpty(),
    body('label').isString().trim().notEmpty(),
    body('tg_theme_url')
      .optional({ nullable: true })
      .isString()
      .custom((value) => {
        if (typeof value !== 'string') return false;
        const trimmed = value.trim();
        if (!trimmed) return true;
        return parseTopicLink(trimmed) !== null;
      })
      .withMessage('Ссылка на тему Telegram имеет неверный формат'),
  ]),
  async (req, res) => {
    const { name } = req.params as { name: string };
    const { label, tg_theme_url } = req.body as {
      label: string;
      tg_theme_url?: string | null;
    };
    await updateTaskTypeSettings(name, label, tg_theme_url ?? undefined);
    const types = await getTaskTypeSettings();
    const type = types.find((item) => item.name === name.trim());
    if (!type) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Не удалось обновить тип задачи',
        status: 500,
        detail: 'Настройка не найдена после обновления',
      });
      return;
    }
    res.json({
      name: type.name,
      label: type.label,
      defaultLabel: type.defaultLabel,
      tg_theme_url: type.tg_theme_url,
    });
  },
);

router.post(
  '/cache/refresh',
  ...base,
  requireRole('admin'),
  async (_req, res) => {
    clearTaskSettingsCache();
    const [fields, types] = await Promise.all([
      getTaskFieldSettings(),
      getTaskTypeSettings(),
    ]);
    const payload: TaskSettingsResponse = {
      fields,
      types: types.map((type) => ({
        name: type.name,
        label: type.label,
        defaultLabel: type.defaultLabel,
        tg_theme_url: type.tg_theme_url,
      })),
    };
    res.json(payload);
  },
);

export default router;
