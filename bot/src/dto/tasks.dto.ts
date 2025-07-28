// Назначение файла: DTO для операций с задачами
// Основные модули: routes, middleware
const { body } = require('express-validator')
const fields = require('../../shared/taskFields.cjs')
const statusField = fields.find((f) => f.name === 'status')
const statusList = statusField ? statusField.options : ['Новая','В работе','Выполнена','Отменена']

class CreateTaskDto {
  static rules() {
    return [
      body('title').isString().notEmpty(),
      body('task_description').optional().isString().isLength({ max: 4096 }),
      body('status').optional().isString().isIn(statusList),
      body('start_date').optional().isISO8601(),
      body('assignees').optional().isArray(),
    ]
  }
}

class UpdateTaskDto {
  static rules() {
    return [
      body('title').optional().isString(),
      body('task_description').optional().isString().isLength({ max: 4096 }),
      body('status').optional().isString().isIn(statusList),
    ]
  }
}

class AddTimeDto {
  static rules() {
    return [body('minutes').isInt({ min: 1 })]
  }
}

class BulkStatusDto {
  static rules() {
    return [
      body('ids').isArray({ min: 1 }),
      body('status').isString().isIn(statusList),
    ]
  }
}

module.exports = {
  CreateTaskDto,
  UpdateTaskDto,
  AddTimeDto,
  BulkStatusDto,
}
