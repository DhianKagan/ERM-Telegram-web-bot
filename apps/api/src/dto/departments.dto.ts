// Назначение файла: DTO для департаментов
// Основные модули: express-validator
import { body } from 'express-validator';

export class CreateDepartmentDto {
  static rules() {
    return [body('fleetId').isMongoId(), body('name').isString().notEmpty()];
  }
}

export class UpdateDepartmentDto {
  static rules() {
    return [
      body('fleetId').optional().isMongoId(),
      body('name').optional().isString().notEmpty(),
    ];
  }
}

export default { CreateDepartmentDto, UpdateDepartmentDto };
