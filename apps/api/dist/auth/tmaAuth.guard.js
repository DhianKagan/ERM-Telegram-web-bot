"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = tmaAuthGuard;
const verifyInitData_1 = __importDefault(require("../utils/verifyInitData"));
const problem_1 = require("../utils/problem");
function tmaAuthGuard(req, res, next) {
    const auth = req.headers.authorization;
    let raw = null;
    if (auth && auth.startsWith('tma ')) {
        raw = auth.slice(4).trim();
    }
    else if (req.headers['x-telegram-init-data']) {
        raw = String(req.headers['x-telegram-init-data']);
    }
    if (!raw) {
        (0, problem_1.sendProblem)(req, res, {
            type: 'about:blank',
            title: 'Ошибка авторизации',
            status: 401,
            detail: 'invalid init data',
        });
        return;
    }
    try {
        res.locals.initData = (0, verifyInitData_1.default)(raw);
    }
    catch {
        (0, problem_1.sendProblem)(req, res, {
            type: 'about:blank',
            title: 'Ошибка авторизации',
            status: 401,
            detail: 'invalid init data',
        });
        return;
    }
    next();
}
