"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = checkRole;
const accessMask_1 = require("../utils/accessMask");
const service_1 = require("../services/service");
const problem_1 = require("../utils/problem");
function checkRole(expected) {
    return (req, res, next) => {
        var _a, _b, _c, _d, _e;
        const role = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) || 'user';
        const mask = (_c = (_b = req.user) === null || _b === void 0 ? void 0 : _b.access) !== null && _c !== void 0 ? _c : accessMask_1.ACCESS_USER;
        if (typeof expected === 'number') {
            if ((0, accessMask_1.hasAccess)(mask, expected))
                return next();
        }
        else {
            const allowed = Array.isArray(expected) ? expected : [expected];
            if (allowed.includes(role))
                return next();
        }
        (0, service_1.writeLog)(`Недостаточно прав ${req.method} ${req.originalUrl} user:${(_d = req.user) === null || _d === void 0 ? void 0 : _d.id}/${(_e = req.user) === null || _e === void 0 ? void 0 : _e.username} ip:${req.ip}`).catch(() => { });
        (0, problem_1.sendProblem)(req, res, {
            type: 'about:blank',
            title: 'Доступ запрещён',
            status: 403,
            detail: 'Forbidden',
        });
    };
}
