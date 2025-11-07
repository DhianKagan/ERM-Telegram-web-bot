"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = verifyInitData;
// Назначение файла: проверка подписи initData Telegram WebApp
// Основные модули: crypto, config
const node_crypto_1 = __importDefault(require("node:crypto"));
const config_1 = __importDefault(require("../config"));
const { botToken } = config_1.default;
function buildDataCheckString(params) {
    const pairs = [];
    params.forEach((value, key) => {
        if (key !== 'hash') {
            pairs.push(`${key}=${value}`);
        }
    });
    return pairs.sort().join('\n');
}
function validateSignature(params, token, options) {
    const hash = params.get('hash');
    if (!hash) {
        throw new Error('hash отсутствует');
    }
    const dataString = buildDataCheckString(params);
    const secret = node_crypto_1.default.createHmac('sha256', 'WebAppData').update(token).digest();
    const calculated = node_crypto_1.default
        .createHmac('sha256', secret)
        .update(dataString)
        .digest('hex');
    if (calculated !== hash) {
        throw new Error('Недействительная подпись initData');
    }
    const authDateRaw = params.get('auth_date');
    if (!authDateRaw) {
        throw new Error('auth_date отсутствует');
    }
    const authDate = Number(authDateRaw);
    if (!Number.isFinite(authDate)) {
        throw new Error('Некорректное значение auth_date');
    }
    const expiresIn = options.expiresIn ?? 0;
    if (expiresIn > 0) {
        const now = Math.floor(Date.now() / 1000);
        if (now - authDate > expiresIn) {
            throw new Error('initData просрочен');
        }
    }
    return authDate;
}
function parseInitData(params, authDate) {
    const result = { auth_date: authDate, authDate };
    params.forEach((value, key) => {
        if (key === 'hash') {
            return;
        }
        if (key === 'user' || key === 'receiver' || key === 'chat') {
            try {
                result[key] = JSON.parse(value);
                return;
            }
            catch {
                result[key] = null;
                return;
            }
        }
        if (key === 'auth_date') {
            return;
        }
        result[key] = value;
    });
    return result;
}
function verifyInitData(initData) {
    const token = botToken;
    if (!token) {
        throw new Error('BOT_TOKEN не задан');
    }
    const params = new URLSearchParams(initData);
    const authDate = validateSignature(params, token, { expiresIn: 300 });
    return parseInitData(params, authDate);
}
