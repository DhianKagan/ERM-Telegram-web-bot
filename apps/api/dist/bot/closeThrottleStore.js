"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetCloseThrottle = exports.updateCloseThrottleUntil = exports.getCloseThrottleUntil = void 0;
// Назначение: хранение таймстемпа троттлинга метода close Telegram между перезапусками бота.
// Основные модули: fs, path, os.
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const STORE_DIRECTORY = node_path_1.default.join(node_os_1.default.tmpdir(), 'erm-telegram-bot');
const STORE_FILENAME = 'closeThrottle.json';
const STORE_PATH = node_path_1.default.join(STORE_DIRECTORY, STORE_FILENAME);
const readStoreSafely = () => {
    try {
        const buffer = node_fs_1.default.readFileSync(STORE_PATH, 'utf8');
        const payload = JSON.parse(buffer);
        const value = Number(payload.closeThrottleUntil);
        return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    }
    catch (error) {
        if (typeof error === 'object' && error && 'code' in error) {
            const { code } = error;
            if (code === 'ENOENT') {
                return 0;
            }
        }
        console.warn('Не удалось прочитать значение троттла метода close из хранилища', error);
        return 0;
    }
};
const ensureDirectoryExists = () => {
    try {
        node_fs_1.default.mkdirSync(STORE_DIRECTORY, { recursive: true });
    }
    catch (error) {
        console.warn('Не удалось создать каталог для хранения троттла метода close', error);
    }
};
const getCloseThrottleUntil = () => readStoreSafely();
exports.getCloseThrottleUntil = getCloseThrottleUntil;
const updateCloseThrottleUntil = (timestamp) => {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        (0, exports.resetCloseThrottle)();
        return;
    }
    ensureDirectoryExists();
    const payload = {
        closeThrottleUntil: Math.floor(timestamp),
    };
    try {
        node_fs_1.default.writeFileSync(STORE_PATH, JSON.stringify(payload));
    }
    catch (error) {
        console.warn('Не удалось записать значение троттла метода close в хранилище', error);
    }
};
exports.updateCloseThrottleUntil = updateCloseThrottleUntil;
const resetCloseThrottle = () => {
    try {
        node_fs_1.default.rmSync(STORE_PATH, { force: true });
    }
    catch (error) {
        console.warn('Не удалось удалить значение троттла метода close из хранилища', error);
    }
};
exports.resetCloseThrottle = resetCloseThrottle;
