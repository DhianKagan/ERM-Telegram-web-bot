"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = validateDto;
// Назначение файла: middleware для проверки DTO
// Основные модули: express-validator
const express_validator_1 = require("express-validator");
const problem_1 = require("../utils/problem");
function validateDto(Dto) {
    return [
        ...Dto.rules(),
        (req, res, next) => {
            const errors = (0, express_validator_1.validationResult)(req);
            if (errors.isEmpty())
                return next();
            const errorList = errors.array();
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Ошибка валидации',
                status: 400,
                detail: 'Ошибка валидации',
                errors: errorList,
            });
        },
    ];
}
