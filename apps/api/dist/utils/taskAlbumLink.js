"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTaskAlbumLink = resolveTaskAlbumLink;
// Назначение: вычисляет ссылку на альбом задачи для Telegram-клавиатур
// Основные модули: utils/messageLink
const messageLink_1 = __importDefault(require("./messageLink"));
const toNumericId = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};
const normalizeChatId = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value.toString();
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : undefined;
    }
    return undefined;
};
const normalizeMessageId = (value) => {
    const numeric = toNumericId(value);
    if (numeric === null || numeric <= 0) {
        return null;
    }
    return Math.trunc(numeric);
};
const normalizeTopicId = (value) => {
    const numeric = toNumericId(value);
    if (numeric === null || numeric <= 0) {
        return null;
    }
    return Math.trunc(numeric);
};
function resolveTaskAlbumLink(source, context = {}) {
    const explicitChatId = normalizeChatId(source.telegram_photos_chat_id);
    const fallbackChatId = normalizeChatId(context.fallbackChatId);
    const targetChatId = explicitChatId ?? fallbackChatId;
    if (!targetChatId) {
        return null;
    }
    const messageIdNumeric = normalizeMessageId(source.telegram_photos_message_id);
    if (messageIdNumeric === null) {
        return null;
    }
    const explicitTopicId = normalizeTopicId(source.telegram_photos_topic_id);
    const fallbackTopicId = normalizeTopicId(context.fallbackTopicId);
    const topicIdForLink = explicitTopicId ??
        (fallbackTopicId &&
            (!explicitChatId || !fallbackChatId || explicitChatId === fallbackChatId)
            ? fallbackTopicId
            : null);
    return ((0, messageLink_1.default)(targetChatId, messageIdNumeric, topicIdForLink ?? undefined) ?? null);
}
exports.default = resolveTaskAlbumLink;
