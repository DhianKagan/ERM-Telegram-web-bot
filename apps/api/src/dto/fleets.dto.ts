// Назначение файла: DTO для флотов
// Основные модули: express-validator, services/wialon, utils/wialonLocator
import { body } from 'express-validator';
import { DEFAULT_BASE_URL } from '../services/wialon';
import { parseLocatorLink } from '../utils/wialonLocator';

function ensureLocatorLink(value: string) {
  parseLocatorLink(value, DEFAULT_BASE_URL);
}

export class CreateFleetDto {
  static rules() {
    return [
      body('name').isString().notEmpty(),
      body('link')
        .isString()
        .notEmpty()
        .custom((value) => {
          ensureLocatorLink(value);
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
          ensureLocatorLink(value);
          return true;
        }),
    ];
  }
}

export default { CreateFleetDto, UpdateFleetDto };
