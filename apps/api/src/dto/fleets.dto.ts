// Назначение файла: DTO для объектов автопарка
// Основные модули: express-validator
import { body } from 'express-validator';

const registrationPattern = /^[A-ZА-ЯІЇЄ]{2} \d{4} [A-ZА-ЯІЇЄ]{2}$/u;
const fuelTypes = ['Бензин', 'Дизель', 'Газ'];
const transportTypes = ['Легковой', 'Грузовой'];

function numberField(field: string) {
  return body(field).isNumeric().withMessage(`${field} должен быть числом`).custom((value) => {
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

function defaultDriverField() {
  return body('defaultDriverId')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === undefined || value === null || value === '') {
        return true;
      }
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('defaultDriverId должен быть положительным целым числом');
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
      numberField('payloadCapacityKg'),
      body('transportType').isIn(transportTypes),
      body('fuelType').isIn(fuelTypes),
      numberField('fuelRefilled'),
      numberField('fuelAverageConsumption'),
      numberField('fuelSpentTotal'),
      tasksField(),
      defaultDriverField(),
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
      numberField('payloadCapacityKg').optional({ nullable: true }),
      body('transportType').optional().isIn(transportTypes),
      body('fuelType').optional().isIn(fuelTypes),
      numberField('fuelRefilled').optional({ nullable: true }),
      numberField('fuelAverageConsumption').optional({ nullable: true }),
      numberField('fuelSpentTotal').optional({ nullable: true }),
      tasksField(),
      defaultDriverField(),
    ];
  }
}

export default { CreateFleetDto, UpdateFleetDto };
