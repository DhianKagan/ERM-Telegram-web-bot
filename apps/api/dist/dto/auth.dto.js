"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateProfileDto = exports.VerifyInitDto = exports.VerifyCodeDto = exports.SendCodeDto = void 0;
// Назначение файла: DTO запросов авторизации
// Основные модули: routes, middleware
const express_validator_1 = require("express-validator");
class SendCodeDto {
    static rules() {
        return [(0, express_validator_1.body)('telegramId').isInt()];
    }
}
exports.SendCodeDto = SendCodeDto;
class VerifyCodeDto {
    static rules() {
        return [(0, express_validator_1.body)('telegramId').isInt(), (0, express_validator_1.body)('code').isLength({ min: 4 })];
    }
}
exports.VerifyCodeDto = VerifyCodeDto;
class VerifyInitDto {
    static rules() {
        return [(0, express_validator_1.body)('initData').isString()];
    }
}
exports.VerifyInitDto = VerifyInitDto;
class UpdateProfileDto {
    static rules() {
        return [
            (0, express_validator_1.body)('name').optional().isString().notEmpty(),
            (0, express_validator_1.body)('phone').optional().isMobilePhone('any'),
            (0, express_validator_1.body)('mobNumber').optional().isMobilePhone('any'),
            (0, express_validator_1.body)('email').optional().isEmail(),
        ];
    }
}
exports.UpdateProfileDto = UpdateProfileDto;
exports.default = {
    SendCodeDto,
    VerifyCodeDto,
    VerifyInitDto,
    UpdateProfileDto,
};
