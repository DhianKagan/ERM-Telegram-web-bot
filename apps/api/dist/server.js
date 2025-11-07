"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Назначение файла: стартовый скрипт API.
// Основные модули: di, api
require("./di");
const config_1 = __importDefault(require("./config"));
const server_1 = __importDefault(require("./api/server"));
(0, server_1.default)()
    .then((app) => {
    const port = config_1.default.port;
    app.listen(port, '0.0.0.0', () => {
        console.log(`API запущен на порту ${port}`);
        console.log(`Окружение: ${process.env.NODE_ENV || 'development'}, Node ${process.version}`);
    });
})
    .catch((e) => {
    console.error('API не стартовал', e);
    process.exit(1);
});
