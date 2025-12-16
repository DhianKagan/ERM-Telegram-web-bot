"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleValidation = handleValidation;
exports.default = validate;
const express_validator_1 = require("express-validator");
const problem_1 = require("./problem");
const requestUploads_1 = require("./requestUploads");
const hasFieldParam = (error) => typeof error.param === 'string';
const hasFieldPath = (error) => typeof error.path === 'string';
const hasNestedErrors = (error) => Array.isArray(error.nestedErrors);
const getParamName = (error) => {
    if (hasFieldPath(error)) {
        return error.path.trim();
    }
    if (hasFieldParam(error)) {
        return error.param.trim();
    }
    if (hasNestedErrors(error)) {
        for (const nested of error.nestedErrors) {
            const param = getParamName(nested);
            if (param) {
                return param;
            }
        }
    }
    return '';
};
function handleValidation(req, res, next) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (errors.isEmpty())
        return next();
    const errorList = errors.array();
    const detailMessages = errorList
        .map((error) => {
        const param = getParamName(error);
        const rawMessage = error.msg;
        const message = typeof rawMessage === 'string'
            ? rawMessage.trim()
            : rawMessage != null
                ? String(rawMessage).trim()
                : '';
        if (param && message) {
            return `${param} — ${message}`;
        }
        if (message) {
            return message;
        }
        return null;
    })
        .filter((value) => Boolean(value));
    const detail = detailMessages.length > 0
        ? `Поля: ${detailMessages.join('; ')}`
        : 'Ошибка валидации';
    void (0, requestUploads_1.cleanupUploadedFiles)(req);
    (0, problem_1.sendProblem)(req, res, {
        type: 'about:blank',
        title: 'Ошибка валидации',
        status: 400,
        detail,
        errors: errorList,
    });
}
function validate(rules) {
    return [...rules, handleValidation];
}
