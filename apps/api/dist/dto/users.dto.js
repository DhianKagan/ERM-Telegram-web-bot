"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteUserDto = exports.UpdateUserDto = exports.CreateUserDto = void 0;
// Назначение файла: DTO для пользователей
// Основные модули: routes, middleware
const express_validator_1 = require("express-validator");
class CreateUserDto {
    static rules() {
        return [
            (0, express_validator_1.body)('id').optional({ checkFalsy: true }).isInt(),
            (0, express_validator_1.body)('username').optional({ checkFalsy: true }).isString(),
            (0, express_validator_1.body)('roleId').optional().isMongoId(),
        ];
    }
}
exports.CreateUserDto = CreateUserDto;
class UpdateUserDto {
    static rules() {
        return [
            (0, express_validator_1.body)('username').optional().isString(),
            (0, express_validator_1.body)('name').optional().isString(),
            (0, express_validator_1.body)('phone').optional().isString(),
            (0, express_validator_1.body)('mobNumber').optional().isString(),
            (0, express_validator_1.body)('email').optional({ checkFalsy: true }).isEmail(),
            (0, express_validator_1.body)('roleId').optional().isMongoId(),
            (0, express_validator_1.body)('departmentId').optional().isMongoId(),
            (0, express_validator_1.body)('divisionId').optional().isMongoId(),
            (0, express_validator_1.body)('positionId').optional().isMongoId(),
            (0, express_validator_1.body)('receive_reminders').optional().isBoolean(),
            (0, express_validator_1.body)('verified_at').optional().isISO8601(),
        ];
    }
}
exports.UpdateUserDto = UpdateUserDto;
class DeleteUserDto {
    static rules() {
        return [(0, express_validator_1.param)('id').isInt().withMessage('ID должен быть числом')];
    }
}
exports.DeleteUserDto = DeleteUserDto;
exports.default = { CreateUserDto, UpdateUserDto };
