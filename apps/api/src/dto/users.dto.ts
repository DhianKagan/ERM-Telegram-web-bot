// Назначение файла: DTO для пользователей
// Основные модули: routes, middleware
import { body, param } from 'express-validator';

export class CreateUserDto {
  static rules() {
    return [
      body('id').optional({ checkFalsy: true }).isInt(),
      body('username').optional({ checkFalsy: true }).isString(),
      body('roleId').optional().isMongoId(),
    ];
  }
}

export class UpdateUserDto {
  static rules() {
    return [
      body('username').optional().isString(),
      body('name').optional().isString(),
      body('phone').optional().isString(),
      body('mobNumber').optional().isString(),
      body('email').optional({ checkFalsy: true }).isEmail(),
      body('roleId').optional().isMongoId(),
      body('departmentId').optional().isMongoId(),
      body('divisionId').optional().isMongoId(),
      body('positionId').optional().isMongoId(),
      body('receive_reminders').optional().isBoolean(),
      body('verified_at').optional().isISO8601(),
    ];
  }
}

export class DeleteUserDto {
  static rules() {
    return [param('id').isInt().withMessage('ID должен быть числом')];
  }
}
export default { CreateUserDto, UpdateUserDto };
