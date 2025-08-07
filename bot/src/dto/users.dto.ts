// Назначение файла: DTO для пользователей
// Основные модули: routes, middleware
import { body } from 'express-validator'

export class CreateUserDto {
  static rules() {
    return [
      body('id').isInt(),
      body('username').isString().notEmpty(),
      body('roleId').optional().isMongoId(),
    ]
  }
}

export default { CreateUserDto }
