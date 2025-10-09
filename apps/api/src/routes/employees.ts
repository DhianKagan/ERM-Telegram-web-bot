// Роуты сотрудников: CRUD операции
// Модули: express, express-validator, middleware/auth, models/employee, middleware/validateDto
import { Router, RequestHandler } from 'express';
import createRateLimiter from '../utils/rateLimiter';
import { param } from 'express-validator';
import authMiddleware from '../middleware/auth';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_ADMIN } from '../utils/accessMask';
import validateDto from '../middleware/validateDto';
import { CreateEmployeeDto, UpdateEmployeeDto } from '../dto/employees.dto';
import { Employee } from '../db/models/employee';

const router: Router = Router();
const limiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  name: 'employees',
});
const middlewares = [
  authMiddleware(),
  limiter as unknown as RequestHandler,
  Roles(ACCESS_ADMIN) as unknown as RequestHandler,
  rolesGuard as unknown as RequestHandler,
];

router.get('/', ...middlewares, async (req, res) => {
  const fields =
    typeof req.query.fields === 'string'
      ? req.query.fields.split(',').join(' ')
      : undefined;

  const employees = await Employee.find({}, fields).populate(
    'departmentId divisionId positionId',
  );
  res.json(employees);
});

router.post(
  '/',
  ...middlewares,
  ...(validateDto(CreateEmployeeDto) as RequestHandler[]),
  async (req, res) => {
    const employee = await Employee.create(req.body);
    await employee.populate('departmentId divisionId positionId');
    res.status(201).json(employee);
  },
);

router.put(
  '/:id',
  ...middlewares,
  param('id').isMongoId(),
  ...(validateDto(UpdateEmployeeDto) as RequestHandler[]),
  async (req, res) => {
    const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!employee) {
      res.sendStatus(404);
      return;
    }
    await employee.populate('departmentId divisionId positionId');
    res.json(employee);
  },
);

router.delete(
  '/:id',
  ...middlewares,
  param('id').isMongoId(),
  async (req, res) => {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) {
      res.sendStatus(404);
      return;
    }
    res.json({ status: 'ok' });
  },
);

export default router;
