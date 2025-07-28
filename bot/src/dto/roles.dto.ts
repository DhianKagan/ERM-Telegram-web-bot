// Назначение файла: DTO для ролей
// Основные модули: routes, middleware
const { body } = require('express-validator')

class UpdateRoleDto {
  static rules() {
    return [
      body('permissions')
        .isArray()
        .custom(arr => arr.every(item => typeof item === 'string' || typeof item === 'number')),
    ]
  }
}

module.exports = { UpdateRoleDto }
