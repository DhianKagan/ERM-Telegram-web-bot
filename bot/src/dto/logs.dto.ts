// Назначение файла: DTO для логов
// Основные модули: routes, middleware
const { body } = require('express-validator')

class CreateLogDto {
  static rules() {
    return [body('message').isString().notEmpty()]
  }
}

module.exports = { CreateLogDto }
