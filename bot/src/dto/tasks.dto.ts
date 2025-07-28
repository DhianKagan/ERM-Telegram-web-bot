// Назначение файла: DTO для операций с задачами
// Основные модули: routes, middleware
const { body } = require('express-validator')

class CreateTaskDto {
  static rules() {
    return [
      body('title').optional().isString(),
      body('start_date').optional().isISO8601(),
      body('assignees').optional().isArray(),
    ]
  }
}

class UpdateTaskDto {
  static rules() {
    return [body('status').optional().isString()]
  }
}

class AddTimeDto {
  static rules() {
    return [body('minutes').isInt({ min: 1 })]
  }
}

class BulkStatusDto {
  static rules() {
    return [body('ids').isArray({ min: 1 }), body('status').isString()]
  }
}

module.exports = {
  CreateTaskDto,
  UpdateTaskDto,
  AddTimeDto,
  BulkStatusDto,
}
