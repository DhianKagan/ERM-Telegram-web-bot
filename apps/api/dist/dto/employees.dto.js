"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateEmployeeDto = exports.CreateEmployeeDto = void 0;
// Назначение файла: DTO для сотрудников
// Основные модули: express-validator
const express_validator_1 = require("express-validator");
class CreateEmployeeDto {
    static rules() {
        return [
            (0, express_validator_1.body)('departmentId').isMongoId(),
            (0, express_validator_1.body)('divisionId').optional().isMongoId(),
            (0, express_validator_1.body)('positionId').optional().isMongoId(),
            (0, express_validator_1.body)('name').isString().notEmpty(),
        ];
    }
}
exports.CreateEmployeeDto = CreateEmployeeDto;
class UpdateEmployeeDto {
    static rules() {
        return [
            (0, express_validator_1.body)('departmentId').optional().isMongoId(),
            (0, express_validator_1.body)('divisionId').optional().isMongoId(),
            (0, express_validator_1.body)('positionId').optional().isMongoId(),
            (0, express_validator_1.body)('name').optional().isString().notEmpty(),
        ];
    }
}
exports.UpdateEmployeeDto = UpdateEmployeeDto;
exports.default = { CreateEmployeeDto, UpdateEmployeeDto };
