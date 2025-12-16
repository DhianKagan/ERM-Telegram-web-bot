"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskFormValidators = exports.buildValidators = exports.formSchema = void 0;
// Модуль форм. Назначение: загрузка схемы формы и серверная валидация.
// Модули: express-validator, shared
const express_validator_1 = require("express-validator");
const shared_1 = require("shared");
exports.formSchema = shared_1.taskFormSchema;
const buildValidators = (schema) => {
    const chains = [
        (0, express_validator_1.body)('formVersion')
            .equals(String(schema.formVersion))
            .withMessage('Неизвестная версия формы'),
    ];
    for (const section of schema.sections) {
        for (const field of section.fields) {
            let chain = (0, express_validator_1.body)(field.name);
            if (field.required)
                chain = chain.notEmpty();
            else
                chain = chain.optional();
            switch (field.type) {
                case 'datetime':
                    chain = chain.isISO8601().withMessage('Неверная дата');
                    break;
                case 'segment':
                case 'text':
                case 'textarea':
                default:
                    chain = chain.isString();
            }
            chains.push(chain);
        }
    }
    return chains;
};
exports.buildValidators = buildValidators;
exports.taskFormValidators = (0, exports.buildValidators)(exports.formSchema);
