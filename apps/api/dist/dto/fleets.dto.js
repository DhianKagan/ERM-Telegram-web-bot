"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateFleetDto = exports.CreateFleetDto = void 0;
// Назначение файла: DTO для объектов автопарка
// Основные модули: express-validator
const express_validator_1 = require("express-validator");
const registrationPattern = /^[A-ZА-ЯІЇЄ]{2} \d{4} [A-ZА-ЯІЇЄ]{2}$/u;
const fuelTypes = ['Бензин', 'Дизель', 'Газ'];
const transportTypes = ['Легковой', 'Грузовой'];
function numberField(field) {
    return (0, express_validator_1.body)(field)
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
    return (0, express_validator_1.body)('currentTasks')
        .optional()
        .isArray()
        .withMessage('currentTasks должен быть массивом')
        .custom((value) => {
        const invalid = value.find((item) => typeof item !== 'string');
        if (invalid) {
            throw new Error('currentTasks должны содержать строки');
        }
        return true;
    });
}
const parseCoordinate = (value, min, max, field) => {
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
    return (0, express_validator_1.body)('position')
        .optional({ nullable: true })
        .custom((value) => {
        if (value === null) {
            return true;
        }
        if (typeof value !== 'object' || value === null) {
            throw new Error('position должен быть объектом');
        }
        const { lat, lon, timestamp } = value;
        parseCoordinate(lat, -90, 90, 'lat');
        parseCoordinate(lon, -180, 180, 'lon');
        if (timestamp !== undefined && timestamp !== null) {
            const date = timestamp instanceof Date ? timestamp : new Date(String(timestamp));
            if (Number.isNaN(date.getTime())) {
                throw new Error('timestamp должен быть корректной датой');
            }
        }
        return true;
    });
}
class CreateFleetDto {
    static rules() {
        return [
            (0, express_validator_1.body)('name').isString().trim().notEmpty(),
            (0, express_validator_1.body)('registrationNumber')
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
            (0, express_validator_1.body)('transportType').isIn(transportTypes),
            (0, express_validator_1.body)('fuelType').isIn(fuelTypes),
            numberField('fuelRefilled'),
            numberField('fuelAverageConsumption'),
            numberField('fuelSpentTotal'),
            tasksField(),
            positionField(),
        ];
    }
}
exports.CreateFleetDto = CreateFleetDto;
class UpdateFleetDto {
    static rules() {
        return [
            (0, express_validator_1.body)('name').optional().isString().trim().notEmpty(),
            (0, express_validator_1.body)('registrationNumber')
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
            (0, express_validator_1.body)('transportType').optional().isIn(transportTypes),
            (0, express_validator_1.body)('fuelType').optional().isIn(fuelTypes),
            numberField('fuelRefilled').optional({ nullable: true }),
            numberField('fuelAverageConsumption').optional({ nullable: true }),
            numberField('fuelSpentTotal').optional({ nullable: true }),
            tasksField(),
            positionField(),
        ];
    }
}
exports.UpdateFleetDto = UpdateFleetDto;
exports.default = { CreateFleetDto, UpdateFleetDto };
