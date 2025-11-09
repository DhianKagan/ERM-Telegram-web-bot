// Роуты управления черновиками задач
// Основные модули: express, middleware/auth, auth/roles, taskDrafts.controller
import { Router, type RequestHandler } from 'express';
import { body } from 'express-validator';
import authMiddleware from '../middleware/auth';
import { Roles } from '../auth/roles.decorator';
import rolesGuard from '../auth/roles.guard';
import { ACCESS_USER } from '../utils/accessMask';
import container from '../di';
import { TOKENS } from '../di/tokens';
import TaskDraftsController from '../taskDrafts/taskDrafts.controller';
import { asyncHandler } from '../api/middleware';
import { handleValidation } from '../utils/validate';

const router: Router = Router();
const ctrl = container.resolve<TaskDraftsController>(
  TOKENS.TaskDraftsController,
);

router.use(authMiddleware());
router.use(Roles(ACCESS_USER) as unknown as RequestHandler);
router.use(rolesGuard as unknown as RequestHandler);

router.get(
  '/:kind(task|request)',
  asyncHandler(ctrl.get),
);

router.put(
  '/:kind(task|request)',
  [body('payload').optional().isObject()] as unknown as RequestHandler[],
  handleValidation,
  asyncHandler(ctrl.save),
);

router.delete(
  '/:kind(task|request)',
  asyncHandler(ctrl.remove),
);

export default router;
