"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimits = void 0;
// Назначение: конфигурация лимитов запросов
// Основные модули: express-rate-limit
const test = process.env.NODE_ENV === 'test';
exports.rateLimits = {
    auth: {
        windowMs: test ? 200 : 60000,
        max: test ? 2 : 50,
        adminMax: test ? 5 : 500,
        name: 'auth',
        captcha: true,
    },
    route: {
        windowMs: test ? 200 : 60000,
        max: test ? 10 : 30,
        adminMax: test ? 15 : 100,
        name: 'route',
    },
    table: {
        windowMs: test ? 200 : 60000,
        max: test ? 1 : 10,
        adminMax: test ? 3 : 50,
        name: 'route-table',
    },
};
exports.default = exports.rateLimits;
