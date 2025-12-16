"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateRoleDto = void 0;
// Назначение файла: DTO для ролей
// Основные модули: routes, middleware
const express_validator_1 = require("express-validator");
class UpdateRoleDto {
    static rules() {
        return [
            (0, express_validator_1.body)('permissions')
                .isArray()
                .custom((arr) => arr.every((item) => typeof item === 'string' || typeof item === 'number')),
        ];
    }
}
exports.UpdateRoleDto = UpdateRoleDto;
exports.default = { UpdateRoleDto };
