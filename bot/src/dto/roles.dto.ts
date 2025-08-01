// Назначение файла: DTO для ролей
// Основные модули: routes, middleware
import { body } from 'express-validator'

export class UpdateRoleDto {
  static rules() {
    return [
      body('permissions')
        .isArray()
        .custom(arr => arr.every(item => typeof item === 'string' || typeof item === 'number')),
    ]
  }
}

export default { UpdateRoleDto }
module.exports = { UpdateRoleDto }
