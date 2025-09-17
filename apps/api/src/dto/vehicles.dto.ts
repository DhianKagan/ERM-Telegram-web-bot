// Назначение файла: DTO для редактирования транспорта флота
// Основные модули: express-validator
import { body } from 'express-validator';

const sensorsValidator = body('customSensors')
  .optional({ nullable: true })
  .isArray()
  .withMessage('Список датчиков должен быть массивом')
  .custom((value: unknown[]) => {
    if (!Array.isArray(value)) return false;
    value.forEach((sensor) => {
      if (typeof sensor !== 'object' || sensor === null) {
        throw new Error('Каждый датчик должен быть объектом');
      }
      const record = sensor as Record<string, unknown>;
      if (typeof record.name !== 'string' || !record.name.trim()) {
        throw new Error('Имя датчика обязательно');
      }
      if (record.type !== undefined && typeof record.type !== 'string') {
        throw new Error('Тип датчика должен быть строкой');
      }
    });
    return true;
  });

const notesValidator = body('notes')
  .optional({ nullable: true })
  .isString()
  .isLength({ max: 2000 })
  .withMessage('Примечания должны быть строкой до 2000 символов');

export class UpdateVehicleDto {
  static rules() {
    return [
      body('name')
        .optional({ nullable: true })
        .isString()
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Имя транспорта обязательно'),
      notesValidator,
      sensorsValidator,
    ];
  }
}

export class ReplaceVehicleDto {
  static rules() {
    return [
      body('name')
        .isString()
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Имя транспорта обязательно'),
      notesValidator,
      sensorsValidator,
    ];
  }
}

export default { UpdateVehicleDto, ReplaceVehicleDto };
