"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminCodes = exports.codes = exports.refresh = exports.logout = exports.updateProfile = exports.profile = exports.verifyInitData = exports.verifyCode = exports.sendCode = void 0;
// Контроллер авторизации и профиля
// Основные модули: auth.service, utils/formatUser, services/service, utils/setTokenCookie
const auth_service_1 = __importDefault(require("./auth.service"));
const formatUser_1 = __importDefault(require("../utils/formatUser"));
const service_1 = require("../services/service");
const setTokenCookie_1 = __importDefault(require("../utils/setTokenCookie"));
const config_1 = __importDefault(require("../config"));
const problem_1 = require("../utils/problem");
const auth_1 = require("./auth");
const sendCode = async (req, res) => {
    const { telegramId } = req.body;
    try {
        await auth_service_1.default.sendCode(telegramId);
        res.json({ status: 'sent' });
    }
    catch (e) {
        (0, problem_1.sendProblem)(req, res, {
            type: 'about:blank',
            title: 'Ошибка отправки кода',
            status: 400,
            detail: String(e.message),
        });
    }
};
exports.sendCode = sendCode;
const verifyCode = async (req, res) => {
    const { telegramId, code, username } = req.body;
    try {
        const token = await auth_service_1.default.verifyCode(telegramId, code, username);
        (0, setTokenCookie_1.default)(res, token);
        res.json({ token });
    }
    catch (e) {
        (0, problem_1.sendProblem)(req, res, {
            type: 'about:blank',
            title: 'Ошибка подтверждения кода',
            status: 400,
            detail: String(e.message),
        });
    }
};
exports.verifyCode = verifyCode;
const verifyInitData = async (req, res) => {
    try {
        const token = await auth_service_1.default.verifyInitData(req.body.initData);
        (0, setTokenCookie_1.default)(res, token);
        res.json({ token });
    }
    catch (e) {
        (0, problem_1.sendProblem)(req, res, {
            type: 'about:blank',
            title: 'Ошибка авторизации',
            status: 400,
            detail: String(e.message),
        });
    }
};
exports.verifyInitData = verifyInitData;
const profile = async (req, res) => {
    const user = await auth_service_1.default.getProfile(req.user.id);
    if (!user) {
        (0, problem_1.sendProblem)(req, res, {
            type: 'about:blank',
            title: 'Пользователь не найден',
            status: 404,
            detail: 'Not Found',
        });
        return;
    }
    res.json((0, formatUser_1.default)(user));
};
exports.profile = profile;
const updateProfile = async (req, res) => {
    const user = await auth_service_1.default.updateProfile(req.user.id, req.body);
    if (!user) {
        (0, problem_1.sendProblem)(req, res, {
            type: 'about:blank',
            title: 'Пользователь не найден',
            status: 404,
            detail: 'Not Found',
        });
        return;
    }
    await (0, service_1.writeLog)(`Профиль ${req.user.id}/${req.user.username} изменён`);
    res.json((0, formatUser_1.default)(user));
};
exports.updateProfile = updateProfile;
const logout = (_req, res) => {
    const secure = process.env.NODE_ENV === 'production';
    const opts = { httpOnly: true, secure, sameSite: 'lax' };
    if (secure) {
        opts.domain = config_1.default.cookieDomain || new URL(config_1.default.appUrl).hostname;
    }
    res.clearCookie('token', opts);
    res.json({ status: 'ok' });
};
exports.logout = logout;
const refresh = (req, res) => {
    const old = req.cookies?.token;
    if (!old || !req.user) {
        res.sendStatus(401);
        return;
    }
    const token = (0, auth_1.refreshToken)(old);
    (0, setTokenCookie_1.default)(res, token);
    res.json({ token });
};
exports.refresh = refresh;
exports.codes = auth_service_1.default.codes;
exports.adminCodes = auth_service_1.default.adminCodes;
