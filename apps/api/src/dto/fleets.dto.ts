// Назначение файла: DTO для флотов
// Основные модули: express-validator
import { body } from 'express-validator';

export class CreateFleetDto {
  static rules() {
    return [
      body('name').isString().notEmpty(),
      body('token').isString().notEmpty(),
    ];
  }
}

export class UpdateFleetDto {
  static rules() {
    return [
      body('name').optional().isString().notEmpty(),
      body('token').optional().isString().notEmpty(),
    ];
  }
}

export default { CreateFleetDto, UpdateFleetDto };
