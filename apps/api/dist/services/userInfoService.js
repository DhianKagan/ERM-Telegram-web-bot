"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMemberStatus = getMemberStatus;
exports.getTelegramId = getTelegramId;
// Сервис выдачи сведений о пользователе и его статусе в группе
// Модули: telegraf, config
const telegraf_1 = require("telegraf");
const config_1 = require("../config");
const resolveChatId = () => typeof config_1.getChatId === 'function' ? (0, config_1.getChatId)() : config_1.chatId;
const bot = new telegraf_1.Telegraf(config_1.botToken);
/** Возвращает статус участника чата по его Telegram ID. */
async function getMemberStatus(id) {
    const chatId = resolveChatId();
    if (!chatId) {
        throw new Error('CHAT_ID не задан, невозможно получить статус участника');
    }
    const member = await bot.telegram.getChatMember(chatId, id);
    return member.status;
}
/** Извлекает Telegram ID из контекста сообщения. */
function getTelegramId(ctx) {
    var _a;
    return (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id;
}
