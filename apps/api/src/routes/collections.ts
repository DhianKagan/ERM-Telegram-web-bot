// Роуты коллекций: CRUD операции
// Модули: express, middleware/auth, middleware/requireRole, repos/collectionRepo, express-validator
import { Router, RequestHandler } from 'express';
import { param } from 'express-validator';
import createRateLimiter from '../utils/rateLimiter';
import authMiddleware from '../middleware/auth';
import requireRole from '../middleware/requireRole';
import * as repo from '../db/repos/collectionRepo';
import { CollectionItemAttrs } from '../db/models/CollectionItem';

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
  const { items, total } = await repo.list(
    { type, name, value, search },
    Number(page),
    Number(limit),
  );
  res.json({ items, total });
});

router.post('/', ...base, requireRole('admin'), async (req, res) => {
  const item = await repo.create(req.body as CollectionItemAttrs);
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
    const item = await repo.remove(req.params.id);
    if (!item) {
      res.sendStatus(404);
      return;
    }
    res.json({ status: 'ok' });
  },
);

export default router;
