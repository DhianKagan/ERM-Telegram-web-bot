// Назначение файла: DTO для пользователей
// Основные модули: routes, middleware
const { body } = require('express-validator')

class CreateUserDto {
  static rules() {
    return [
      body('id').isInt(),
      body('username').isString().notEmpty(),
      body('roleId').optional().isMongoId(),
    ]
  }
}

module.exports = { CreateUserDto }
