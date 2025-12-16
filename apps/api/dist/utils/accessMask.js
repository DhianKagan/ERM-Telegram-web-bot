"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACCESS_TASK_DELETE = exports.ACCESS_MANAGER = exports.ACCESS_ADMIN = exports.ACCESS_USER = void 0;
exports.hasAccess = hasAccess;
// Назначение файла: константы масок доступа и проверка прав
// Основные модули: отсутствуют
exports.ACCESS_USER = 1;
exports.ACCESS_ADMIN = 2;
exports.ACCESS_MANAGER = 4;
exports.ACCESS_TASK_DELETE = 8;
function hasAccess(mask, required) {
    let effectiveMask = mask;
    if ((effectiveMask & exports.ACCESS_TASK_DELETE) === exports.ACCESS_TASK_DELETE) {
        effectiveMask |= exports.ACCESS_ADMIN | exports.ACCESS_MANAGER;
    }
    if ((effectiveMask & (exports.ACCESS_ADMIN | exports.ACCESS_MANAGER)) !== 0) {
        effectiveMask |= exports.ACCESS_USER;
    }
    return (effectiveMask & required) === required;
}
