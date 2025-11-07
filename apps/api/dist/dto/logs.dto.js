"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateLogDto = void 0;
// Назначение файла: DTO для логов
// Основные модули: routes, middleware
const express_validator_1 = require("express-validator");
class CreateLogDto {
    static rules() {
        return [(0, express_validator_1.body)('message').isString().notEmpty()];
    }
}
exports.CreateLogDto = CreateLogDto;
exports.default = { CreateLogDto };
