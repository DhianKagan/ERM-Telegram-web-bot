"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = rolesGuard;
// Назначение файла: guard для проверки маски доступа пользователя
// Основные модули: utils/accessMask, services/service
const accessMask_1 = require("../utils/accessMask");
const service_1 = require("../services/service");
const roles_decorator_1 = require("./roles.decorator");
const problem_1 = require("../utils/problem");
function rolesGuard(req, res, next) {
    var _a, _b, _c;
    const required = req[roles_decorator_1.ROLES_KEY];
    if (!required)
        return next();
    const mask = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.access) || accessMask_1.ACCESS_USER;
    if ((0, accessMask_1.hasAccess)(mask, required))
        return next();
    (0, service_1.writeLog)(`Недостаточно прав ${req.method} ${req.originalUrl} user:${(_b = req.user) === null || _b === void 0 ? void 0 : _b.id}/${(_c = req.user) === null || _c === void 0 ? void 0 : _c.username} ip:${req.ip}`).catch(() => { });
    (0, problem_1.sendProblem)(req, res, {
        type: 'about:blank',
        title: 'Доступ запрещён',
        status: 403,
        detail: 'Forbidden',
    });
    return;
}
