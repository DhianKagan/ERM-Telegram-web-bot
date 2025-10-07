// Роуты настроек задач: управление подписями полей и темами Telegram.
// Основные модули: express, middleware/auth, services/taskSettings.
import { Router, RequestHandler } from 'express';
import { body, param } from 'express-validator';
import { taskFields, TASK_TYPES } from 'shared';
import createRateLimiter from '../utils/rateLimiter';
import authMiddleware from '../middleware/auth';
import requireRole from '../middleware/requireRole';
import validate from '../utils/validate';
import { sendProblem } from '../utils/problem';
import {
  getTaskFieldSettings,
  setTaskFieldLabel,
  getTaskTypeSettings,
  setTaskTypeTheme,
} from '../services/taskSettings';

const router = Router();

const limiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  name: 'task-settings',
});

const base = [limiter as unknown as RequestHandler, authMiddleware()];

const allowedFieldNames = new Set(taskFields.map((field) => field.name));
const allowedTaskTypes = new Set<string>(TASK_TYPES);

router.get('/', ...base, async (req, res) => {
  try {
    const [fields, types] = await Promise.all([
      getTaskFieldSettings(),
      getTaskTypeSettings(),
    ]);
    res.json({ fields, types });
  } catch (error) {
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Не удалось загрузить настройки задач',
      status: 500,
      detail: (error as Error).message,
    });
  }
});

router.put(
  '/fields/:name',
  ...base,
  requireRole('admin'),
  param('name')
    .custom((value) => allowedFieldNames.has(value))
    .withMessage('Неизвестное поле задачи'),
  ...validate([
    body('label')
      .isString()
      .withMessage('Название поля должно быть строкой')
      .bail()
      .custom((raw) => typeof raw === 'string' && raw.trim().length > 0)
      .withMessage('Название поля не может быть пустым'),
  ]),
  async (req, res) => {
    const { name } = req.params;
    const { label } = req.body as { label: string };
    try {
      const doc = await setTaskFieldLabel(name, label);
      res.json({ name: doc.name, label: doc.value });
    } catch (error) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Не удалось обновить название поля',
        status: 400,
        detail: (error as Error).message,
      });
    }
  },
);

router.put(
  '/types/:type',
  ...base,
  requireRole('admin'),
  param('type')
    .custom((value) => allowedTaskTypes.has(value))
    .withMessage('Неизвестный тип задачи'),
  ...validate([
    body('tg_theme_url')
      .optional({ nullable: true })
      .isString()
      .withMessage('Ссылка должна быть строкой')
      .bail()
      .custom((raw) =>
        typeof raw === 'string'
          ? raw.trim().length === 0 || /^https?:\/\//i.test(raw.trim())
          : raw === null,
      )
      .withMessage('Ссылка должна начинаться с http:// или https://'),
  ]),
  async (req, res) => {
    const { type } = req.params;
    const { tg_theme_url } = req.body as { tg_theme_url?: string | null };
    try {
      const setting = await setTaskTypeTheme(type, tg_theme_url ?? null);
      res.json(setting);
    } catch (error) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Не удалось обновить тему для задач',
        status: 400,
        detail: (error as Error).message,
      });
    }
  },
);

export default router;
