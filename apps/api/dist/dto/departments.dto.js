"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateDepartmentDto = exports.CreateDepartmentDto = void 0;
// Назначение файла: DTO для департаментов
// Основные модули: express-validator
const express_validator_1 = require("express-validator");
class CreateDepartmentDto {
    static rules() {
        return [(0, express_validator_1.body)('fleetId').isMongoId(), (0, express_validator_1.body)('name').isString().notEmpty()];
    }
}
exports.CreateDepartmentDto = CreateDepartmentDto;
class UpdateDepartmentDto {
    static rules() {
        return [
            (0, express_validator_1.body)('fleetId').optional().isMongoId(),
            (0, express_validator_1.body)('name').optional().isString().notEmpty(),
        ];
    }
}
exports.UpdateDepartmentDto = UpdateDepartmentDto;
exports.default = { CreateDepartmentDto, UpdateDepartmentDto };
