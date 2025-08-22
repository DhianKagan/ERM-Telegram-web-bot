// Назначение файла: DTO для операций с задачами
// Основные модули: routes, middleware
import { body } from 'express-validator';
import { taskFields } from 'shared';
const statusField = taskFields.find((f) => f.name === 'status');
const statusList: readonly string[] = statusField?.options ?? [
  'Новая',
  'В работе',
  'Выполнена',
  'Отменена',
];

export class CreateTaskDto {
  static rules() {
    return [
      body('title').isString().notEmpty(),
      body('task_description').optional().isString().isLength({ max: 4096 }),
      body('status').optional().isString().isIn(statusList),
      body('start_date').optional().isISO8601(),
      body('assignees').optional().isArray(),
    ];
  }
}

export class UpdateTaskDto {
  static rules() {
    return [
      body('title').optional().isString(),
      body('task_description').optional().isString().isLength({ max: 4096 }),
      body('status').optional().isString().isIn(statusList),
    ];
  }
}

export class AddTimeDto {
  static rules() {
    return [body('minutes').isInt({ min: 1 })];
  }
}

export class BulkStatusDto {
  static rules() {
    return [
      body('ids').isArray({ min: 1 }),
      body('status').isString().isIn(statusList),
    ];
  }
}

export default {
  CreateTaskDto,
  UpdateTaskDto,
  AddTimeDto,
  BulkStatusDto,
};
