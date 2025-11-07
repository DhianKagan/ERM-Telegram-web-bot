"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Назначение файла: точка входа для процесса Telegram-бота.
// Основные модули: bot, scheduler, keyRotation
const bot_1 = require("./bot");
const scheduler_1 = require("../services/scheduler");
const keyRotation_1 = require("../services/keyRotation");
if (process.env.NODE_ENV !== 'test') {
    (0, bot_1.startBot)()
        .then(() => {
        (0, scheduler_1.startScheduler)();
        (0, keyRotation_1.startKeyRotation)();
    })
        .catch((error) => {
        console.error('Критическая ошибка запуска процесса бота', error);
        process.exit(1);
    });
}
