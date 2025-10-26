// Роуты шаблонов задач
// Модули: express, controllers/taskTemplates, middleware/auth
import { Router, RequestHandler } from 'express';
import { body, param } from 'express-validator';
import container from '../di';
import TaskTemplatesController from '../taskTemplates/taskTemplates.controller';
import authMiddleware from '../middleware/auth';
import { handleValidation } from '../utils/validate';

const router: Router = Router();
const ctrl = container.resolve(TaskTemplatesController);

router.get('/', authMiddleware(), ctrl.list as RequestHandler);
router.get(
  '/:id',
  authMiddleware(),
  param('id')
    .isMongoId()
    .withMessage('некорректный идентификатор шаблона'),
  handleValidation,
  ctrl.detail as RequestHandler,
);
router.post(
  '/',
  authMiddleware(),
  body('name')
    .isString()
    .withMessage('Название должно быть строкой')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Название не может быть пустым'),
  body('data')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null) return true;
      return typeof value === 'object' && !Array.isArray(value);
    })
    .withMessage('Данные шаблона должны быть объектом'),
  ...(ctrl.create as RequestHandler[]),
);
router.delete(
  '/:id',
  authMiddleware(),
  param('id')
    .isMongoId()
    .withMessage('некорректный идентификатор шаблона'),
  ...(ctrl.remove as RequestHandler[]),
);

export default router;
