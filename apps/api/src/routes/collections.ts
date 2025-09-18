// Роуты коллекций: CRUD операции
// Модули: express, middleware/auth, middleware/requireRole, middleware/sendProblem, repos/collectionRepo, express-validator
import { Router, RequestHandler } from 'express';
import { Types } from 'mongoose';
import { param } from 'express-validator';
import createRateLimiter from '../utils/rateLimiter';
import authMiddleware from '../middleware/auth';
import requireRole from '../middleware/requireRole';
import * as repo from '../db/repos/collectionRepo';
import {
  CollectionItem,
  CollectionItemAttrs,
  type CollectionItemDocument,
} from '../db/models/CollectionItem';
import { Employee } from '../db/models/employee';
import { Task } from '../db/model';
import type RequestWithUser from '../types/request';
import { sendProblem } from '../utils/problem';
import { Fleet } from '../db/models/fleet';
import { Vehicle } from '../db/models/vehicle';
import { parseLocatorLink } from '../utils/wialonLocator';
import { DEFAULT_BASE_URL } from '../services/wialon';
import { syncFleetVehicles } from '../services/fleetVehicles';

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
  if (type === 'fleets') {
    const role = (req as RequestWithUser).user?.role ?? 'user';
    if (role !== 'admin' && role !== 'manager') {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Доступ запрещён',
        status: 403,
        detail: 'Недостаточно прав для просмотра автопарка',
      });
      return;
    }
  }
  const { items, total } = await repo.list(
    { type, name, value, search },
    Number(page),
    Number(limit),
  );
  res.json({ items, total });
});

router.get('/:type', ...base, async (req, res) => {
  const { type } = req.params;
  if (type === 'fleets') {
    const role = (req as RequestWithUser).user?.role ?? 'user';
    if (role !== 'admin' && role !== 'manager') {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Доступ запрещён',
        status: 403,
        detail: 'Недостаточно прав для просмотра автопарка',
      });
      return;
    }
  }
  const { items } = await repo.list({ type }, 1, 1000);
  res.json(items);
});

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

async function createFleetAndCollectionItem(
  body: CollectionItemAttrs,
  req: RequestWithUser,
  res: Parameters<typeof sendProblem>[1],
): Promise<void> {
  if (!isNonEmptyString(body.name) || !isNonEmptyString(body.value)) {
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Некорректные данные автопарка',
      status: 400,
      detail: 'Название и ссылка автопарка обязательны',
    });
    return;
  }
  let locator;
  try {
    locator = parseLocatorLink(body.value, DEFAULT_BASE_URL);
  } catch (error) {
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Некорректная ссылка Wialon',
      status: 400,
      detail:
        error instanceof Error
          ? error.message
          : 'Не удалось разобрать ссылку автопарка',
    });
    return;
  }
  const id = new Types.ObjectId();
  try {
    const fleet = await Fleet.create({
      _id: id,
      name: body.name,
      token: locator.token,
      locatorUrl: locator.locatorUrl,
      baseUrl: locator.baseUrl,
      locatorKey: locator.locatorKey,
    });
    try {
      await syncFleetVehicles(fleet);
    } catch (error) {
      console.error(
        `Не удалось синхронизировать транспорт автопарка ${fleet._id}:`,
        error,
      );
      await Vehicle.deleteMany({ fleetId: fleet._id });
      await Fleet.findByIdAndDelete(fleet._id);
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Синхронизация автопарка не выполнена',
        status: 502,
        detail: 'Не удалось синхронизировать транспорт автопарка',
      });
      return;
    }
    const item = await repo.create({
      _id: id,
      type: 'fleets',
      name: body.name,
      value: body.value,
    });
    res.status(201).json(item);
  } catch (error) {
    console.error('Ошибка создания автопарка из коллекции:', error);
    await Fleet.findByIdAndDelete(id).catch(() => undefined);
    await Vehicle.deleteMany({ fleetId: id }).catch(() => undefined);
    sendProblem(req, res, {
      type: 'about:blank',
      title: 'Не удалось создать автопарк',
      status: 500,
      detail:
        error instanceof Error ? error.message : 'Неизвестная ошибка сервера',
    });
  }
}

router.post('/', ...base, requireRole('admin'), async (req, res) => {
  const body = req.body as CollectionItemAttrs;
  if (body.type === 'fleets') {
    await createFleetAndCollectionItem(body, req as RequestWithUser, res);
    return;
  }
  const item = await repo.create(body);
  res.status(201).json(item);
});

router.put(
  '/:id',
  ...base,
  requireRole('admin'),
  param('id').isMongoId(),
  async (req, res) => {
    const { id } = req.params;
    const current = (await CollectionItem.findById(id)) as
      | (CollectionItemDocument & { save: () => Promise<CollectionItemDocument> })
      | null;
    if (!current) {
      res.sendStatus(404);
      return;
    }
    if (current.type !== 'fleets') {
      const item = await repo.update(
        req.params.id,
        req.body as Partial<CollectionItemAttrs>,
      );
      if (!item) {
        res.sendStatus(404);
        return;
      }
      res.json(item);
      return;
    }

    const body = req.body as Partial<CollectionItemAttrs>;
    const nextName = isNonEmptyString(body.name) ? body.name.trim() : current.name;
    const hasValueUpdate = isNonEmptyString(body.value);
    let locator;
    if (hasValueUpdate) {
      try {
        locator = parseLocatorLink(body.value as string, DEFAULT_BASE_URL);
      } catch (error) {
        sendProblem(req as RequestWithUser, res, {
          type: 'about:blank',
          title: 'Некорректная ссылка Wialon',
          status: 400,
          detail:
            error instanceof Error
              ? error.message
              : 'Не удалось разобрать ссылку автопарка',
        });
        return;
      }
    }

    let fleet = await Fleet.findById(id);
    if (!fleet) {
      const valueForCreation = hasValueUpdate ? (body.value as string) : current.value;
      try {
        const data = locator ?? parseLocatorLink(valueForCreation, DEFAULT_BASE_URL);
        fleet = await Fleet.create({
          _id: current._id,
          name: nextName,
          token: data.token,
          locatorUrl: data.locatorUrl,
          baseUrl: data.baseUrl,
          locatorKey: data.locatorKey,
        });
      } catch (error) {
        sendProblem(req as RequestWithUser, res, {
          type: 'about:blank',
          title: 'Не удалось обновить автопарк',
          status: 400,
          detail:
            error instanceof Error
              ? error.message
              : 'Ошибка при создании автопарка',
        });
        return;
      }
    } else {
      fleet.name = nextName;
      if (locator) {
        fleet.token = locator.token;
        fleet.locatorUrl = locator.locatorUrl;
        fleet.baseUrl = locator.baseUrl;
        fleet.locatorKey = locator.locatorKey;
      }
      await fleet.save();
    }

    try {
      await syncFleetVehicles(fleet);
    } catch (error) {
      console.error(
        `Не удалось синхронизировать транспорт автопарка ${fleet._id}:`,
        error,
      );
      sendProblem(req as RequestWithUser, res, {
        type: 'about:blank',
        title: 'Синхронизация автопарка не выполнена',
        status: 502,
        detail: 'Не удалось синхронизировать транспорт автопарка',
      });
      return;
    }

    current.name = nextName;
    if (hasValueUpdate && body.value) {
      current.value = body.value;
    }
    const saved = await current.save();
    res.json(saved);
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
    if (item.type === 'fleets') {
      await Vehicle.deleteMany({ fleetId: item._id });
      await Fleet.findByIdAndDelete(item._id);
      await item.deleteOne();
      res.json({ status: 'ok' });
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
