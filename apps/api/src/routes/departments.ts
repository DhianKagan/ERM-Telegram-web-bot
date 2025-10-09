// Роуты департаментов: CRUD операции
// Модули: express, express-validator, middleware/auth, models/department, middleware/validateDto
import { Router, RequestHandler } from 'express';
import createRateLimiter from '../utils/rateLimiter';
import { param } from 'express-validator';
import authMiddleware from '../middleware/auth';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_ADMIN } from '../utils/accessMask';
import validateDto from '../middleware/validateDto';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from '../dto/departments.dto';
import { Department } from '../db/models/department';

const router: Router = Router();
const limiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  name: 'departments',
});
const middlewares = [
  authMiddleware(),
  limiter as unknown as RequestHandler,
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
];

router.get('/', ...middlewares, async (_req, res) => {
  const departments = await Department.find();
  res.json(departments);
});

router.post(
  '/',
  ...middlewares,
  ...(validateDto(CreateDepartmentDto) as RequestHandler[]),
  async (req, res) => {
    const department = await Department.create(req.body);
    res.status(201).json(department);
  },
);

router.put(
  '/:id',
  ...middlewares,
  param('id').isMongoId(),
  ...(validateDto(UpdateDepartmentDto) as RequestHandler[]),
  async (req, res) => {
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );
    if (!department) {
      res.sendStatus(404);
      return;
    }
    res.json(department);
  },
);

router.delete(
  '/:id',
  ...middlewares,
  param('id').isMongoId(),
  async (req, res) => {
    const department = await Department.findByIdAndDelete(req.params.id);
    if (!department) {
      res.sendStatus(404);
      return;
    }
    res.json({ status: 'ok' });
  },
);

export default router;
