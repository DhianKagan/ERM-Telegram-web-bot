"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = connect;
// Управление подключением к MongoDB с пулом соединений и резервным URL
// Модули: mongoose, config
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config"));
const { mongoUrl } = config_1.default;
const backupUrl = process.env.MONGO_BACKUP_URL;
// Увеличиваем количество попыток подключения по умолчанию,
// чтобы Railway успел запустить MongoDB
const attempts = Number(process.env.RETRY_ATTEMPTS || 10);
const delayMs = Number(process.env.RETRY_DELAY_MS || 5000);
// Для версии mongoose 8 опции useNewUrlParser и useUnifiedTopology
// больше не требуются, оставляем только размер пула
const opts = { maxPoolSize: 10 };
let connecting;
mongoose_1.default.connection.on('disconnected', async () => {
    console.error('Соединение с MongoDB прервано');
    if (backupUrl && mongoUrl !== backupUrl) {
        try {
            await mongoose_1.default.connect(backupUrl, opts);
            console.log('Подключились к резервной базе');
        }
        catch (e) {
            const err = e;
            console.error('Ошибка подключения к резервной базе:', err.message);
        }
    }
});
mongoose_1.default.connection.on('error', (e) => {
    const err = e;
    console.error('Ошибка MongoDB:', err.message);
});
async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
async function connect() {
    if (mongoose_1.default.connection.readyState === 1)
        return mongoose_1.default.connection;
    if (connecting) {
        await connecting;
        return mongoose_1.default.connection;
    }
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            connecting = mongoose_1.default.connect(mongoUrl, opts);
            await connecting;
            return mongoose_1.default.connection;
        }
        catch (e) {
            const err = e;
            console.error(`Попытка ${attempt} не удалась:`, err.message);
            if (attempt === attempts)
                throw e;
            await sleep(delayMs);
        }
        finally {
            connecting = null;
        }
    }
    return mongoose_1.default.connection;
}
