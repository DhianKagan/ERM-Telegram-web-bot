// Назначение файла: DTO для объектов автопарка
// Основные модули: express-validator
import { body } from 'express-validator';

const registrationPattern = /^[A-ZА-ЯІЇЄ]{2} \d{4} [A-ZА-ЯІЇЄ]{2}$/u;
const fuelTypes = ['Бензин', 'Дизель', 'Газ'];
const transportTypes = ['Легковой', 'Грузовой'];

function numberField(field: string) {
  return body(field)
    .isNumeric()
    .withMessage(`${field} должен быть числом`)
    .custom((value) => {
      if (Number(value) < 0) {
        throw new Error(`${field} не может быть отрицательным`);
      }
      return true;
    });
}

function tasksField() {
  return body('currentTasks')
    .optional()
    .isArray()
    .withMessage('currentTasks должен быть массивом')
    .custom((value: unknown[]) => {
      const invalid = value.find((item) => typeof item !== 'string');
      if (invalid) {
        throw new Error('currentTasks должны содержать строки');
      }
      return true;
    });
}

const parseCoordinate = (
  value: unknown,
  min: number,
  max: number,
  field: string,
): number => {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
    throw new Error(`${field} должен быть числом`);
  }
  if (parsed < min || parsed > max) {
    throw new Error(`${field} должен быть в диапазоне [${min}; ${max}]`);
  }
  return parsed;
};

function positionField() {
  return body('position')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null) {
        return true;
      }
      if (typeof value !== 'object' || value === null) {
        throw new Error('position должен быть объектом');
      }
      const { lat, lon, timestamp } = value as Record<string, unknown>;
      parseCoordinate(lat, -90, 90, 'lat');
      parseCoordinate(lon, -180, 180, 'lon');
      if (timestamp !== undefined && timestamp !== null) {
        const date =
          timestamp instanceof Date ? timestamp : new Date(String(timestamp));
        if (Number.isNaN(date.getTime())) {
          throw new Error('timestamp должен быть корректной датой');
        }
      }
      return true;
    });
}

export class CreateFleetDto {
  static rules() {
    return [
      body('name').isString().trim().notEmpty(),
      body('registrationNumber')
        .isString()
        .trim()
        .notEmpty()
        .custom((value) => {
          if (!registrationPattern.test(value.toUpperCase())) {
            throw new Error('Некорректный регистрационный номер');
          }
          return true;
        }),
      numberField('odometerInitial'),
      numberField('odometerCurrent'),
      numberField('mileageTotal'),
      body('transportType').isIn(transportTypes),
      body('fuelType').isIn(fuelTypes),
      numberField('fuelRefilled'),
      numberField('fuelAverageConsumption'),
      numberField('fuelSpentTotal'),
      tasksField(),
      positionField(),
    ];
  }
}

export class UpdateFleetDto {
  static rules() {
    return [
      body('name').optional().isString().trim().notEmpty(),
      body('registrationNumber')
        .optional()
        .isString()
        .trim()
        .notEmpty()
        .custom((value) => {
          if (!registrationPattern.test(value.toUpperCase())) {
            throw new Error('Некорректный регистрационный номер');
          }
          return true;
        }),
      numberField('odometerInitial').optional({ nullable: true }),
      numberField('odometerCurrent').optional({ nullable: true }),
      numberField('mileageTotal').optional({ nullable: true }),
      body('transportType').optional().isIn(transportTypes),
      body('fuelType').optional().isIn(fuelTypes),
      numberField('fuelRefilled').optional({ nullable: true }),
      numberField('fuelAverageConsumption').optional({ nullable: true }),
      numberField('fuelSpentTotal').optional({ nullable: true }),
      tasksField(),
      positionField(),
    ];
  }
}

export default { CreateFleetDto, UpdateFleetDto };
