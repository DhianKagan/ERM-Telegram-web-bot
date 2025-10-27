// Роуты шаблонов задач
// Модули: express, controllers/taskTemplates, middleware/auth
import { Router, RequestHandler } from 'express';
import { param } from 'express-validator';
import container from '../di';
import TaskTemplatesController from '../taskTemplates/taskTemplates.controller';
import authMiddleware from '../middleware/auth';

const router: Router = Router();
const ctrl = container.resolve(TaskTemplatesController);

router.get('/', authMiddleware(), ctrl.list as RequestHandler);
router.get(
  '/:id',
  authMiddleware(),
  param('id').isMongoId(),
  ctrl.detail as RequestHandler,
);
router.post('/', authMiddleware(), ...(ctrl.create as RequestHandler[]));

export default router;
