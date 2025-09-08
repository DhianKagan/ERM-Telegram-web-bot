// Роуты флотов: CRUD операции
// Модули: express, express-validator, middleware/auth, models/fleet, middleware/validateDto
import { Router, RequestHandler } from 'express';
import createRateLimiter from '../utils/rateLimiter';
import { param } from 'express-validator';
import authMiddleware from '../middleware/auth';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_ADMIN } from '../utils/accessMask';
import validateDto from '../middleware/validateDto';
import { CreateFleetDto, UpdateFleetDto } from '../dto/fleets.dto';
import { Fleet } from '../db/models/fleet';

const router: Router = Router();
const limiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  name: 'fleets',
});
const middlewares = [
  limiter as unknown as RequestHandler,
  authMiddleware(),
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
];

router.get('/', ...middlewares, async (_req, res) => {
  const fleets = await Fleet.find();
  res.json(fleets);
});

router.post(
  '/',
  ...middlewares,
  ...(validateDto(CreateFleetDto) as RequestHandler[]),
  async (req, res) => {
    const fleet = await Fleet.create(req.body);
    res.status(201).json(fleet);
  },
);

router.put(
  '/:id',
  ...middlewares,
  param('id').isMongoId(),
  ...(validateDto(UpdateFleetDto) as RequestHandler[]),
  async (req, res) => {
    const fleet = await Fleet.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!fleet) {
      res.sendStatus(404);
      return;
    }
    res.json(fleet);
  },
);

router.delete(
  '/:id',
  ...middlewares,
  param('id').isMongoId(),
  async (req, res) => {
    const fleet = await Fleet.findByIdAndDelete(req.params.id);
    if (!fleet) {
      res.sendStatus(404);
      return;
    }
    res.json({ status: 'ok' });
  },
);

export default router;
