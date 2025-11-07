"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = checkRole;
const accessMask_1 = require("../utils/accessMask");
const service_1 = require("../services/service");
const problem_1 = require("../utils/problem");
function checkRole(expected) {
    return (req, res, next) => {
        const role = req.user?.role || 'user';
        const mask = req.user?.access ?? accessMask_1.ACCESS_USER;
        if (typeof expected === 'number') {
            if ((0, accessMask_1.hasAccess)(mask, expected))
                return next();
        }
        else {
            const allowed = Array.isArray(expected) ? expected : [expected];
            if (allowed.includes(role))
                return next();
        }
        (0, service_1.writeLog)(`Недостаточно прав ${req.method} ${req.originalUrl} user:${req.user?.id}/${req.user?.username} ip:${req.ip}`).catch(() => { });
        (0, problem_1.sendProblem)(req, res, {
            type: 'about:blank',
            title: 'Доступ запрещён',
            status: 403,
            detail: 'Forbidden',
        });
    };
}
