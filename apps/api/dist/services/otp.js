"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAttempts = exports.adminCodes = exports.attempts = exports.codes = void 0;
exports.sendCode = sendCode;
exports.sendManagerCode = sendManagerCode;
exports.sendAdminCode = sendAdminCode;
exports.verifyCode = verifyCode;
exports.verifyAdminCode = verifyAdminCode;
// Сервис генерации и проверки одноразовых кодов
// Модули: telegramApi
const telegramApi_1 = require("./telegramApi");
exports.codes = new Map();
exports.attempts = new Map();
exports.adminCodes = new Map();
exports.adminAttempts = new Map();
const EXPIRATION_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
function clean() {
    const now = Date.now();
    for (const [key, value] of exports.codes) {
        if (now - value.ts > EXPIRATION_MS)
            exports.codes.delete(key);
    }
    for (const [key, value] of exports.attempts) {
        if (now - value.ts > EXPIRATION_MS)
            exports.attempts.delete(key);
    }
    for (const [key, value] of exports.adminCodes) {
        if (now - value.ts > EXPIRATION_MS)
            exports.adminCodes.delete(key);
    }
    for (const [key, value] of exports.adminAttempts) {
        if (now - value.ts > EXPIRATION_MS)
            exports.adminAttempts.delete(key);
    }
}
setInterval(clean, EXPIRATION_MS).unref();
async function sendCode({ telegramId }) {
    clean();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const text = `Код входа для пользователя: ${code}`;
    const key = String(telegramId);
    exports.codes.set(key, { code, ts: Date.now() });
    exports.attempts.delete(key);
    await (0, telegramApi_1.call)('sendMessage', { chat_id: telegramId, text });
}
async function sendManagerCode({ telegramId, }) {
    clean();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const text = `Код входа для менеджера: ${code}`;
    const key = String(telegramId);
    exports.codes.set(key, { code, ts: Date.now() });
    exports.attempts.delete(key);
    await (0, telegramApi_1.call)('sendMessage', { chat_id: telegramId, text });
}
async function sendAdminCode({ telegramId, }) {
    clean();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const text = `Код входа для Админа: ${code}`;
    const key = String(telegramId);
    exports.adminCodes.set(key, { code, ts: Date.now() });
    exports.adminAttempts.delete(key);
    await (0, telegramApi_1.call)('sendMessage', { chat_id: telegramId, text });
}
function verifyCode({ telegramId, code }) {
    clean();
    const key = String(telegramId);
    const entry = exports.codes.get(key);
    const info = exports.attempts.get(key) || { count: 0, ts: Date.now() };
    if (entry &&
        info.count < MAX_ATTEMPTS &&
        entry.code === code &&
        Date.now() - entry.ts <= EXPIRATION_MS) {
        exports.codes.delete(key);
        exports.attempts.delete(key);
        return true;
    }
    info.count += 1;
    info.ts = Date.now();
    exports.attempts.set(key, info);
    if (info.count >= MAX_ATTEMPTS)
        exports.codes.delete(key);
    return false;
}
function verifyAdminCode({ telegramId, code }) {
    clean();
    const key = String(telegramId);
    const entry = exports.adminCodes.get(key);
    const info = exports.adminAttempts.get(key) || { count: 0, ts: Date.now() };
    if (entry &&
        info.count < MAX_ATTEMPTS &&
        entry.code === code &&
        Date.now() - entry.ts <= EXPIRATION_MS) {
        exports.adminCodes.delete(key);
        exports.adminAttempts.delete(key);
        return true;
    }
    info.count += 1;
    info.ts = Date.now();
    exports.adminAttempts.set(key, info);
    if (info.count >= MAX_ATTEMPTS)
        exports.adminCodes.delete(key);
    return false;
}
