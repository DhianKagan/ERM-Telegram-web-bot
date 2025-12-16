"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurgeArchiveDto = void 0;
// DTO архива задач
// Основные модули: express-validator
const express_validator_1 = require("express-validator");
class PurgeArchiveDto {
    static rules() {
        return [
            (0, express_validator_1.body)('ids')
                .isArray({ min: 1, max: 100 })
                .withMessage('Не выбрано ни одной задачи для удаления'),
            (0, express_validator_1.body)('ids.*')
                .isMongoId()
                .withMessage('Некорректный идентификатор задачи'),
        ];
    }
}
exports.PurgeArchiveDto = PurgeArchiveDto;
exports.default = { PurgeArchiveDto };
