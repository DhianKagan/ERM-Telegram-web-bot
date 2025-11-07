"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Сервис авторизации: отправка и проверка кодов входа
// Основные модули: otp, queries, userInfoService, writeLog, roleCache
const otp = __importStar(require("../services/otp"));
const auth_1 = require("./auth");
const queries_1 = require("../db/queries");
const accessMask_1 = require("../utils/accessMask");
const userInfoService_1 = require("../services/userInfoService");
const service_1 = require("../services/service");
const roleCache_1 = require("../db/roleCache");
async function sendCode(telegramId) {
    if (!telegramId)
        throw new Error('telegramId required');
    const user = await (0, queries_1.getUser)(telegramId);
    const roleId = user?.roleId?.toString();
    const adminRoleId = await (0, roleCache_1.resolveRoleId)('admin');
    const managerRoleId = await (0, roleCache_1.resolveRoleId)('manager');
    if (adminRoleId && roleId === adminRoleId.toString()) {
        await otp.sendAdminCode({ telegramId: Number(telegramId) });
    }
    else if (managerRoleId && roleId === managerRoleId.toString()) {
        await otp.sendManagerCode({ telegramId: Number(telegramId) });
    }
    else {
        await otp.sendCode({ telegramId: Number(telegramId) });
    }
}
async function verifyCode(id, code, username) {
    const telegramId = String(id);
    if (!/^[0-9]+$/.test(telegramId))
        throw new Error('Invalid telegramId');
    let user = await (0, queries_1.getUser)(telegramId);
    let roleId = user?.roleId?.toString();
    const adminRoleId = await (0, roleCache_1.resolveRoleId)('admin');
    const adminRoleIdString = adminRoleId ? adminRoleId.toString() : null;
    let verified;
    if (roleId === adminRoleIdString || otp.adminCodes.has(telegramId)) {
        verified = otp.verifyAdminCode({ telegramId: Number(telegramId), code });
        if (verified && user && roleId !== adminRoleIdString) {
            if (!adminRoleId) {
                throw new Error('Не найдена роль admin');
            }
            user = await (0, queries_1.updateUser)(telegramId, {
                roleId: adminRoleId,
            });
            await (0, service_1.writeLog)(`Пользователь ${telegramId} повышен до администратора`);
            roleId = adminRoleIdString ?? undefined;
        }
    }
    else {
        verified = otp.verifyCode({ telegramId: Number(telegramId), code });
    }
    if (!verified)
        throw new Error('invalid code');
    try {
        const status = await (0, userInfoService_1.getMemberStatus)(Number(telegramId));
        if (!['creator', 'administrator', 'member'].includes(status)) {
            throw new Error('not in group');
        }
    }
    catch (e) {
        if (e instanceof Error && e.message === 'not in group')
            throw e;
        throw new Error('member check failed');
    }
    let u = user;
    if (!u) {
        u = await (0, queries_1.createUser)(telegramId, username, roleId || undefined);
        roleId = u.roleId?.toString() || roleId;
    }
    const managerRoleId = await (0, roleCache_1.resolveRoleId)('manager');
    const managerRoleIdString = managerRoleId ? managerRoleId.toString() : null;
    const role = roleId === adminRoleIdString
        ? 'admin'
        : roleId === managerRoleIdString
            ? 'manager'
            : 'user';
    const access = (0, queries_1.accessByRole)(role);
    const currentAccess = typeof u.access === 'number' ? u.access : null;
    const hasDeleteMask = currentAccess !== null && (0, accessMask_1.hasAccess)(currentAccess, accessMask_1.ACCESS_TASK_DELETE);
    const tokenAccess = hasDeleteMask && currentAccess !== null ? currentAccess | access : access;
    if (currentAccess === null || (currentAccess !== access && !hasDeleteMask)) {
        await (0, queries_1.updateUser)(telegramId, { role });
    }
    const token = (0, auth_1.generateToken)({
        id: telegramId,
        username: u.username || '',
        role,
        access: tokenAccess,
    });
    await (0, service_1.writeLog)(`Вход пользователя ${telegramId}/${u.username}`);
    return token;
}
const verifyInitData_1 = __importDefault(require("../utils/verifyInitData"));
async function verifyInitData(initData) {
    let data;
    try {
        data = (0, verifyInitData_1.default)(initData);
    }
    catch {
        throw new Error('invalid initData');
    }
    const userData = data.user;
    if (!userData)
        throw new Error('invalid user');
    const telegramId = String(userData.id);
    if (!telegramId)
        throw new Error('no user id');
    let user = await (0, queries_1.getUser)(telegramId);
    if (!user) {
        user = await (0, queries_1.createUser)(telegramId, userData.username || '');
    }
    const role = user.role || 'user';
    const access = (0, queries_1.accessByRole)(role);
    const currentAccess = typeof user.access === 'number' ? user.access : null;
    const hasDeleteMask = currentAccess !== null && (0, accessMask_1.hasAccess)(currentAccess, accessMask_1.ACCESS_TASK_DELETE);
    const tokenAccess = hasDeleteMask && currentAccess !== null ? currentAccess | access : access;
    if (currentAccess === null || (currentAccess !== access && !hasDeleteMask)) {
        await (0, queries_1.updateUser)(telegramId, { role });
    }
    const token = (0, auth_1.generateToken)({
        id: telegramId,
        username: user.username || '',
        role,
        access: tokenAccess,
    });
    await (0, service_1.writeLog)(`Вход пользователя ${telegramId}/${user.username}`);
    return token;
}
async function verifyTmaLogin(initData) {
    const userData = initData.user;
    if (!userData)
        throw new Error('invalid user');
    const telegramId = String(userData.id);
    if (!telegramId)
        throw new Error('no user id');
    let user = await (0, queries_1.getUser)(telegramId);
    if (!user) {
        user = await (0, queries_1.createUser)(telegramId, userData.username || '');
    }
    const role = user.role || 'user';
    const access = (0, queries_1.accessByRole)(role);
    const currentAccess = typeof user.access === 'number' ? user.access : null;
    const hasDeleteMask = currentAccess !== null && (0, accessMask_1.hasAccess)(currentAccess, accessMask_1.ACCESS_TASK_DELETE);
    const tokenAccess = hasDeleteMask && currentAccess !== null ? currentAccess | access : access;
    if (currentAccess === null || (currentAccess !== access && !hasDeleteMask)) {
        await (0, queries_1.updateUser)(telegramId, { role });
    }
    const token = (0, auth_1.generateShortToken)({
        id: telegramId,
        username: user.username || '',
        role,
        access: tokenAccess,
    });
    await (0, service_1.writeLog)(`Вход мини-приложения ${telegramId}/${user.username}`);
    return token;
}
async function getProfile(id) {
    const user = await (0, queries_1.getUser)(id);
    return user || null;
}
async function updateProfile(id, data) {
    const user = await (0, queries_1.updateUser)(id, data);
    return user || null;
}
exports.default = {
    sendCode,
    verifyCode,
    verifyInitData,
    verifyTmaLogin,
    getProfile,
    updateProfile,
    codes: otp.codes,
    adminCodes: otp.adminCodes,
};
