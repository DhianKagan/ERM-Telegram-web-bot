// Назначение файла: DTO для операций с задачами
// Основные модули: routes, middleware
import { body } from 'express-validator';
import { taskFields } from 'shared';

const normalizeEmptyNumeric = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

const optionalFloatField = (field: string) =>
  body(field)
    .customSanitizer(normalizeEmptyNumeric)
    .optional({ nullable: true })
    .isFloat({ min: 0 });
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
      optionalFloatField('cargo_length_m'),
      optionalFloatField('cargo_width_m'),
      optionalFloatField('cargo_height_m'),
      optionalFloatField('cargo_volume_m3'),
      optionalFloatField('cargo_weight_kg'),
    ];
  }
}

export class UpdateTaskDto {
  static rules() {
    return [
      body('title').optional().isString(),
      body('task_description').optional().isString().isLength({ max: 4096 }),
      body('status').optional().isString().isIn(statusList),
      optionalFloatField('cargo_length_m'),
      optionalFloatField('cargo_width_m'),
      optionalFloatField('cargo_height_m'),
      optionalFloatField('cargo_volume_m3'),
      optionalFloatField('cargo_weight_kg'),
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
