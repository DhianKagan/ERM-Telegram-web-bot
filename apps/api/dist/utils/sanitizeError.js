"use strict";
// Назначение: упрощённое представление ошибок без стека.
// Основные модули: стандартные типы.
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = sanitizeError;
function sanitizeError(err) {
    if (err instanceof Error) {
        return `${err.name}: ${err.message}`;
    }
    return String(err);
}
