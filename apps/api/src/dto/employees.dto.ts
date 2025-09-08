// Назначение файла: DTO для сотрудников
// Основные модули: express-validator
import { body } from 'express-validator';

export class CreateEmployeeDto {
  static rules() {
    return [
      body('departmentId').isMongoId(),
      body('name').isString().notEmpty(),
    ];
  }
}

export class UpdateEmployeeDto {
  static rules() {
    return [
      body('departmentId').optional().isMongoId(),
      body('name').optional().isString().notEmpty(),
    ];
  }
}

export default { CreateEmployeeDto, UpdateEmployeeDto };
