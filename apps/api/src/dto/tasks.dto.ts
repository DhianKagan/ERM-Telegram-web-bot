// Назначение файла: DTO для операций с задачами
// Основные модули: routes, middleware
import { body } from 'express-validator';
import { taskFields } from 'shared';

const normalizeEmptyNumeric = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

const normalizeEmptyString = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

const optionalFloatField = (field: string) =>
  body(field)
    .customSanitizer(normalizeEmptyNumeric)
    .optional({ nullable: true })
    .isFloat({ min: 0 });

const hasAssignedExecutor = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
};

const hasAssigneeList = (value: unknown): boolean =>
  Array.isArray(value) && value.length > 0;

const executorsRequiredMessage = 'Укажите хотя бы одного исполнителя';
const statusField = taskFields.find((f) => f.name === 'status');
const statusList: readonly string[] = statusField?.options ?? [
  'Новая',
  'В работе',
  'Выполнена',
  'Отменена',
];

const allowedPointKinds = ['start', 'via', 'finish'] as const;

const pointsRule = () =>
  body('points')
    .optional()
    .isArray()
    .custom((value) => {
      if (!Array.isArray(value)) return false;
      value.forEach((point, idx) => {
        if (!point || typeof point !== 'object') {
          throw new Error(`Точка ${idx + 1} должна быть объектом`);
        }
        const payload = point as Record<string, unknown>;
        if (
          payload.kind !== undefined &&
          (typeof payload.kind !== 'string' ||
            !allowedPointKinds.includes(
              payload.kind.trim() as (typeof allowedPointKinds)[number],
            ))
        ) {
          throw new Error(`Некорректный тип точки ${idx + 1}`);
        }
        if (payload.coordinates !== undefined) {
          const coords = payload.coordinates as Record<string, unknown>;
          const lat = Number(coords.lat);
          const lng = Number(coords.lng);
          const latValid =
            coords.lat === undefined ||
            (Number.isFinite(lat) && lat >= -90 && lat <= 90);
          const lngValid =
            coords.lng === undefined ||
            (Number.isFinite(lng) && lng >= -180 && lng <= 180);
          if (!latValid || !lngValid) {
            throw new Error(`Некорректные координаты точки ${idx + 1}`);
          }
        }
      });
      return true;
    });

export class CreateTaskDto {
  static rules() {
    return [
      body('title').isString().notEmpty(),
      body('task_description').optional().isString().isLength({ max: 4096 }),
      body('status').optional().isString().isIn(statusList),
      body('completed_at').optional({ nullable: true }).isISO8601(),
      body('assigned_user_id')
        .customSanitizer(normalizeEmptyNumeric)
        .optional({ nullable: true })
        .isNumeric(),
      body('start_date').optional().isISO8601(),
      body('assignees').optional().isArray(),
      body('transport_driver_id')
        .customSanitizer(normalizeEmptyNumeric)
        .optional({ nullable: true })
        .isNumeric(),
      body('transport_driver_name')
        .customSanitizer(normalizeEmptyString)
        .optional({ nullable: true })
        .isString()
        .isLength({ max: 256 }),
      body('transport_vehicle_id')
        .customSanitizer(normalizeEmptyString)
        .optional({ nullable: true, checkFalsy: true })
        .isMongoId(),
      body()
        .custom((_value, { req }) => {
          const { assignees, assigned_user_id: assignedUserId } = req.body as {
            assignees?: unknown;
            assigned_user_id?: unknown;
          };
          if (
            hasAssigneeList(assignees) ||
            hasAssignedExecutor(assignedUserId)
          ) {
            return true;
          }
          throw new Error(executorsRequiredMessage);
        })
        .withMessage(executorsRequiredMessage),
      body('logistics_enabled').optional().isBoolean().toBoolean(),
      optionalFloatField('cargo_length_m'),
      optionalFloatField('cargo_width_m'),
      optionalFloatField('cargo_height_m'),
      optionalFloatField('cargo_volume_m3'),
      optionalFloatField('cargo_weight_kg'),
      optionalFloatField('payment_amount'),
      pointsRule(),
    ];
  }
}

export class UpdateTaskDto {
  static rules() {
    return [
      body('title').optional().isString(),
      body('task_description').optional().isString().isLength({ max: 4096 }),
      body('status').optional().isString().isIn(statusList),
      body('completed_at').optional({ nullable: true }).isISO8601(),
      body('assigned_user_id')
        .customSanitizer(normalizeEmptyNumeric)
        .optional({ nullable: true })
        .isNumeric(),
      body('transport_driver_id')
        .customSanitizer(normalizeEmptyNumeric)
        .optional({ nullable: true })
        .isNumeric(),
      body('transport_driver_name')
        .customSanitizer(normalizeEmptyString)
        .optional({ nullable: true })
        .isString()
        .isLength({ max: 256 }),
      body('transport_vehicle_id')
        .customSanitizer(normalizeEmptyString)
        .optional({ nullable: true, checkFalsy: true })
        .isMongoId(),
      body()
        .custom((_value, { req }) => {
          const { assignees, assigned_user_id: assignedUserId } = req.body as {
            assignees?: unknown;
            assigned_user_id?: unknown;
          };
          if (
            typeof assignees === 'undefined' &&
            typeof assignedUserId === 'undefined'
          ) {
            return true;
          }
          if (
            hasAssigneeList(assignees) ||
            hasAssignedExecutor(assignedUserId)
          ) {
            return true;
          }
          throw new Error(executorsRequiredMessage);
        })
        .withMessage(executorsRequiredMessage),
      body('logistics_enabled').optional().isBoolean().toBoolean(),
      optionalFloatField('cargo_length_m'),
      optionalFloatField('cargo_width_m'),
      optionalFloatField('cargo_height_m'),
      optionalFloatField('cargo_volume_m3'),
      optionalFloatField('cargo_weight_kg'),
      optionalFloatField('payment_amount'),
      pointsRule(),
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
