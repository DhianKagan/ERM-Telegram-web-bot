// Назначение файла: DTO для логов
// Основные модули: routes, middleware
import { body } from 'express-validator';

export class CreateLogDto {
  static rules() {
    return [body('message').isString().notEmpty()];
  }
}

export default { CreateLogDto };
