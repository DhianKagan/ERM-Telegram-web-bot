"use strict";
// Назначение: утилита для искусственной паузы перед Telegram-операциями
// Основные модули: отсутствуют
Object.defineProperty(exports, "__esModule", { value: true });
exports.delay = void 0;
const delay = (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});
exports.delay = delay;
exports.default = exports.delay;
