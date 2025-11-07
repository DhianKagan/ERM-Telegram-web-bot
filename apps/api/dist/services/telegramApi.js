"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.call = call;
// Сервис прямых вызовов Telegram Bot API
// Модули: fetch, config, AbortController
const config_1 = require("../config");
const BASE = `${config_1.botApiUrl || 'https://api.telegram.org'}/bot${config_1.botToken}/`;
/**
 * Вызов метода Telegram API с повторными попытками
 */
async function call(method, params = {}, attempt = 0) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const res = await fetch(BASE + method, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
            signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok || !data.ok)
            throw new Error(data.description);
        return data.result;
    }
    catch (err) {
        if (attempt < 3) {
            const delay = 2 ** attempt * 500;
            await new Promise((r) => setTimeout(r, delay));
            return call(method, params, attempt + 1);
        }
        throw err;
    }
    finally {
        clearTimeout(timeout);
    }
}
