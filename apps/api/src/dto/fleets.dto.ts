// Назначение файла: DTO для флотов
// Основные модули: express-validator
import { body } from 'express-validator';
import { parseLocatorLink } from '../services/wialon';

export class CreateFleetDto {
  static rules() {
    return [
      body('name').isString().notEmpty(),
      body('link')
        .isString()
        .notEmpty()
        .custom((value) => {
          parseLocatorLink(value);
          return true;
        }),
    ];
  }
}

export class UpdateFleetDto {
  static rules() {
    return [
      body('name').optional().isString().notEmpty(),
      body('link')
        .optional()
        .isString()
        .notEmpty()
        .custom((value) => {
          parseLocatorLink(value);
          return true;
        }),
    ];
  }
}

export default { CreateFleetDto, UpdateFleetDto };
