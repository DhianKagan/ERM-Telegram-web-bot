"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Назначение: глобальный лимитер запросов
// Основные модули: express-rate-limit, express
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, res) => {
        void res;
        return req.path === '/api/v1/csrf';
    },
});
exports.default = globalLimiter;
