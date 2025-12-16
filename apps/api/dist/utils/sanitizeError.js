"use strict";
// Назначение: упрощённое представление ошибок без стека.
// Основные модули: стандартные типы.
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeError = sanitizeError;
function sanitizeError(err) {
    if (err instanceof Error) {
        const name = err.name || 'Error';
        const message = err.message || '';
        return message ? name + ': ' + message : name;
    }
    if (typeof err === 'string') {
        return err;
    }
    try {
        return JSON.stringify(err);
    }
    catch {
        return String(err);
    }
}
exports.default = sanitizeError;
