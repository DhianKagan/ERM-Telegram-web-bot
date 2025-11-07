"use strict";
// Назначение файла: парсинг ссылок на темы Telegram.
// Основные модули: URL.
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTelegramTopicUrl = void 0;
const TELEGRAM_DOMAINS = new Set([
    't.me',
    'telegram.me',
    'telegram.dog',
]);
const TOPIC_PATH_REGEXP = /^\/c\/(\d{1,20})\/(\d{1,20})(?:\/?|$)/;
const ensureUrl = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) {
        return null;
    }
    const hasProtocol = /^[a-z][a-z0-9+.-]*:/.test(trimmed);
    const candidate = hasProtocol ? trimmed : `https://${trimmed}`;
    try {
        return new URL(candidate);
    }
    catch {
        return null;
    }
};
const parseTelegramTopicUrl = (raw) => {
    if (typeof raw !== 'string') {
        return null;
    }
    const url = ensureUrl(raw);
    if (!url) {
        return null;
    }
    const hostname = url.hostname.toLowerCase();
    if (!TELEGRAM_DOMAINS.has(hostname)) {
        return null;
    }
    const match = TOPIC_PATH_REGEXP.exec(url.pathname);
    if (!match) {
        return null;
    }
    const [, chatComponent, topicComponent] = match;
    const topicId = Number(topicComponent);
    if (!Number.isFinite(topicId)) {
        return null;
    }
    const chatId = `-100${chatComponent}`;
    if (!/^(-?\d{5,})$/.test(chatId)) {
        return null;
    }
    return { chatId, topicId };
};
exports.parseTelegramTopicUrl = parseTelegramTopicUrl;
exports.default = { parseTelegramTopicUrl: exports.parseTelegramTopicUrl };
