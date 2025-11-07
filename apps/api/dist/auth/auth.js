"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.generateShortToken = generateShortToken;
exports.refreshToken = refreshToken;
// Назначение файла: генерация JWT.
// Основные модули: jsonwebtoken, config
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config"));
const secretKey = config_1.default.jwtSecret; // переменная гарантирована в config
function generateToken(user) {
    return jsonwebtoken_1.default.sign({
        id: user.id,
        username: user.username,
        role: user.role,
        access: user.access,
    }, secretKey, {
        // токен действует неделю, чтобы вход не требовался каждый час
        expiresIn: '7d',
        algorithm: 'HS256',
    });
}
function generateShortToken(user) {
    return jsonwebtoken_1.default.sign({
        id: user.id,
        username: user.username,
        role: user.role,
        access: user.access,
    }, secretKey, {
        expiresIn: '5m',
        algorithm: 'HS256',
    });
}
function refreshToken(token) {
    const payload = jsonwebtoken_1.default.verify(token, secretKey);
    return generateToken({
        id: payload.id,
        username: payload.username,
        role: payload.role,
        access: payload.access,
    });
}
