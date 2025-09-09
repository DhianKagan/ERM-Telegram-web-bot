// Назначение файла: DTO для пользователей
// Основные модули: routes, middleware
import { body } from 'express-validator';

export class CreateUserDto {
  static rules() {
    return [
      body('id').isInt(),
      body('username').isString().notEmpty(),
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
      body('email').optional().isEmail(),
      body('roleId').optional().isMongoId(),
      body('departmentId').optional().isMongoId(),
      body('divisionId').optional().isMongoId(),
      body('positionId').optional().isMongoId(),
      body('receive_reminders').optional().isBoolean(),
      body('verified_at').optional().isISO8601(),
    ];
  }
}
export default { CreateUserDto, UpdateUserDto };
