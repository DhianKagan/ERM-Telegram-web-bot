// Роуты коллекций: CRUD операции
// Модули: express, middleware/auth, middleware/requireRole, middleware/sendProblem, repos/collectionRepo, express-validator
import { Router, RequestHandler } from 'express';
import { param } from 'express-validator';
import createRateLimiter from '../utils/rateLimiter';
import authMiddleware from '../middleware/auth';
import requireRole from '../middleware/requireRole';
import * as repo from '../db/repos/collectionRepo';
import { CollectionItem, CollectionItemAttrs } from '../db/models/CollectionItem';
import { Employee } from '../db/models/employee';
import { Task } from '../db/model';
import { listCollectionsWithLegacy } from '../services/collectionsAggregator';

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

router.post('/', ...base, requireRole('admin'), async (req, res) => {
  const body = req.body as CollectionItemAttrs;
  const item = await repo.create(body);
  res.status(201).json(item);
});

router.put(
  '/:id',
  ...base,
  requireRole('admin'),
  param('id').isMongoId(),
  async (req, res) => {
    const item = await repo.update(
      req.params.id,
      req.body as Partial<CollectionItemAttrs>,
    );
    if (!item) {
      res.sendStatus(404);
      return;
    }
    res.json(item);
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
