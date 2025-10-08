// DTO архива задач
// Основные модули: express-validator
import { body } from 'express-validator';

export class PurgeArchiveDto {
  static rules() {
    return [
      body('ids')
        .isArray({ min: 1, max: 100 })
        .withMessage('Не выбрано ни одной задачи для удаления'),
      body('ids.*')
        .isMongoId()
        .withMessage('Некорректный идентификатор задачи'),
    ];
  }
}

export default { PurgeArchiveDto };
