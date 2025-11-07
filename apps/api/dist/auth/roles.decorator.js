"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLES_KEY = void 0;
exports.Roles = Roles;
// Назначение файла: декоратор для установки требуемой маски доступа
// Основные модули: middleware
exports.ROLES_KEY = Symbol('roles');
function Roles(mask) {
    return function (req, _res, next) {
        req[exports.ROLES_KEY] = mask;
        return next();
    };
}
exports.default = { Roles, ROLES_KEY: exports.ROLES_KEY };
