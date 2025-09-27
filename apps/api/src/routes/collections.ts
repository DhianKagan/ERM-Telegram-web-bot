// Роуты коллекций: CRUD операции
// Модули: express, middleware/auth, middleware/requireRole, middleware/sendProblem, repos/collectionRepo, express-validator
import { Router, RequestHandler, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { Error as MongooseError } from 'mongoose';
import createRateLimiter from '../utils/rateLimiter';
import authMiddleware from '../middleware/auth';
import requireRole from '../middleware/requireRole';
import * as repo from '../db/repos/collectionRepo';
import { CollectionItem, CollectionItemAttrs } from '../db/models/CollectionItem';
import { Employee } from '../db/models/employee';
import { Task } from '../db/model';
import { listCollectionsWithLegacy } from '../services/collectionsAggregator';
import { sendProblem } from '../utils/problem';
import validate from '../utils/validate';

const router: Router = Router();
const limiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  name: 'collections',
});
const base = [limiter as unknown as RequestHandler, authMiddleware()];

router.get('/', ...base, async (req, res) => {
  const {
    page = '1',
    limit = '20',
    type,
    name,
    value,
    search,
  } = req.query as Record<string, string>;
  const { items, total } = await listCollectionsWithLegacy(
    { type, name, value, search },
    Number(page),
    Number(limit),
  );
  res.json({ items, total });
});

router.get('/:type', ...base, async (req, res) => {
  const { type } = req.params;
  const { items } = await listCollectionsWithLegacy({ type }, 1, 1000);
  res.json(items);
});

const normalizeDepartmentValue = (raw: string): string =>
  raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .join(',');

const normalizeValueByType = (type: string, raw: string): string => {
  const safeType = type.trim();
  if (safeType === 'departments') {
    return normalizeDepartmentValue(raw);
  }
  return raw.trim();
};

router.post(
  '/',
  ...base,
  requireRole('admin'),
  ...validate([
    body('type')
      .isString()
      .withMessage('Некорректный тип коллекции')
      .bail()
      .trim()
      .notEmpty()
      .withMessage('Тип коллекции обязателен'),
    body('name')
      .isString()
      .withMessage('Некорректное название элемента')
      .bail()
      .trim()
      .notEmpty()
      .withMessage('Название элемента обязательно'),
    body('value')
      .isString()
      .withMessage('Некорректное значение элемента')
      .bail()
      .custom((raw, { req }) => {
        if (typeof raw !== 'string') return false;
        const type = typeof req.body?.type === 'string' ? req.body.type.trim() : '';
        if (type === 'departments') {
          return true;
        }
        const normalized = normalizeValueByType(type, raw);
        return normalized.length > 0;
      })
      .withMessage('Значение элемента обязательно'),
  ]),
  async (req, res, next: NextFunction) => {
    try {
      const body = req.body as CollectionItemAttrs;
      const type = body.type.trim();
      const name = body.name.trim();
      const value = normalizeValueByType(type, body.value);
      if (type !== 'departments' && !value) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Ошибка валидации',
          status: 400,
          detail: 'Значение элемента обязательно',
        });
        return;
      }
      const item = await repo.create({ type, name, value });
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof MongooseError.ValidationError) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Ошибка валидации',
          status: 400,
          detail: error.message,
        });
        return;
      }
      next(error);
    }
  },
);

router.put(
  '/:id',
  ...base,
  requireRole('admin'),
  param('id').isMongoId(),
  ...validate([
    body('name')
      .optional()
      .isString()
      .withMessage('Некорректное название элемента')
      .bail()
      .custom((raw) => {
        if (typeof raw !== 'string') return false;
        return raw.trim().length > 0;
      })
      .withMessage('Название элемента не может быть пустым'),
    body('value')
      .optional()
      .isString()
      .withMessage('Некорректное значение элемента'),
  ]),
  async (req, res, next: NextFunction) => {
    try {
      const existing = await CollectionItem.findById(req.params.id).select(
        'type',
      );
      if (!existing) {
        res.sendStatus(404);
        return;
      }
      const body = req.body as Partial<CollectionItemAttrs>;
      const payload: Partial<CollectionItemAttrs> = {};
      if (typeof body.name === 'string') {
        payload.name = body.name.trim();
        if (!payload.name) {
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Ошибка валидации',
            status: 400,
            detail: 'Название элемента не может быть пустым',
          });
          return;
        }
      }
      if (typeof body.value === 'string') {
        const normalizedValue = normalizeValueByType(existing.type, body.value);
        if (existing.type !== 'departments' && !normalizedValue) {
          sendProblem(req, res, {
            type: 'about:blank',
            title: 'Ошибка валидации',
            status: 400,
            detail: 'Значение элемента не может быть пустым',
          });
          return;
        }
        payload.value = normalizedValue;
      }
      const item = await repo.update(existing.id, payload);
      if (!item) {
        res.sendStatus(404);
        return;
      }
      res.json(item);
    } catch (error) {
      if (error instanceof MongooseError.ValidationError) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Ошибка валидации',
          status: 400,
          detail: error.message,
        });
        return;
      }
      next(error);
    }
  },
);

router.delete(
  '/:id',
  ...base,
  requireRole('admin'),
  param('id').isMongoId(),
  async (req, res) => {
    const item = await CollectionItem.findById(req.params.id);
    if (!item) {
      res.sendStatus(404);
      return;
    }
    if (item.type === 'departments') {
      const hasTasks = await Task.exists({
        department: item._id,
      } as Record<string, unknown>);
      const hasEmployees = await Employee.exists({ departmentId: item._id });
      if (hasTasks || hasEmployees) {
        res.status(409).json({
          error:
            'Нельзя удалить департамент: есть связанные задачи или сотрудники',
        });
        return;
      }
    }
    await item.deleteOne();
    res.json({ status: 'ok' });
  },
);

export default router;
