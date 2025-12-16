"use strict";
// Назначение файла: кеширование настроек типов задач и вычисление тем Telegram.
// Основные модули: CollectionItem, parseTelegramTopicUrl.
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTaskTypePhotosTarget = exports.resolveTaskTypeTopicId = exports.resolveTaskTypeSetting = exports.invalidateTaskTypeSettingsCache = void 0;
const CollectionItem_1 = require("../db/models/CollectionItem");
const telegramTopics_1 = require("../utils/telegramTopics");
const CACHE_TTL_MS = 60000;
let cache = { updatedAt: 0, data: new Map() };
const normalizeTypeName = (value) => {
    if (typeof value !== 'string') {
        return '';
    }
    const trimmed = value.trim();
    return trimmed;
};
const buildSetting = (doc) => {
    var _a, _b;
    const type = normalizeTypeName(doc.name);
    if (!type) {
        return null;
    }
    const displayName = normalizeTypeName(doc.value) || type;
    const rawUrl = (_a = doc.meta) === null || _a === void 0 ? void 0 : _a.tg_theme_url;
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    const parsed = url ? (0, telegramTopics_1.parseTelegramTopicUrl)(url) : null;
    const rawPhotosUrl = (_b = doc.meta) === null || _b === void 0 ? void 0 : _b.tg_photos_url;
    const photosUrl = typeof rawPhotosUrl === 'string' ? rawPhotosUrl.trim() : '';
    const photosParsed = photosUrl ? (0, telegramTopics_1.parseTelegramTopicUrl)(photosUrl) : null;
    return {
        type,
        displayName,
        tg_theme_url: url || undefined,
        tg_chat_id: parsed === null || parsed === void 0 ? void 0 : parsed.chatId,
        tg_topic_id: parsed === null || parsed === void 0 ? void 0 : parsed.topicId,
        tg_photos_url: photosUrl || undefined,
        tg_photos_chat_id: photosParsed === null || photosParsed === void 0 ? void 0 : photosParsed.chatId,
        tg_photos_topic_id: photosParsed === null || photosParsed === void 0 ? void 0 : photosParsed.topicId,
    };
};
const loadFromDatabase = async () => {
    const docs = await CollectionItem_1.CollectionItem.find({ type: 'task_types' }).lean();
    const pairs = docs
        .map((doc) => buildSetting(doc))
        .filter((value) => Boolean(value))
        .map((setting) => [setting.type, setting]);
    return new Map(pairs);
};
const invalidateTaskTypeSettingsCache = () => {
    cache = { updatedAt: 0, data: new Map() };
};
exports.invalidateTaskTypeSettingsCache = invalidateTaskTypeSettingsCache;
const loadSettings = async () => {
    const now = Date.now();
    if (now - cache.updatedAt < CACHE_TTL_MS && cache.data.size) {
        return cache.data;
    }
    const data = await loadFromDatabase();
    cache = { updatedAt: now, data };
    return data;
};
const resolveTaskTypeSetting = async (taskType) => {
    var _a;
    const type = normalizeTypeName(taskType);
    if (!type) {
        return null;
    }
    const settings = await loadSettings();
    return (_a = settings.get(type)) !== null && _a !== void 0 ? _a : null;
};
exports.resolveTaskTypeSetting = resolveTaskTypeSetting;
const resolveTaskTypeTopicId = async (taskType) => {
    const setting = await (0, exports.resolveTaskTypeSetting)(taskType);
    return setting === null || setting === void 0 ? void 0 : setting.tg_topic_id;
};
exports.resolveTaskTypeTopicId = resolveTaskTypeTopicId;
const resolveTaskTypePhotosTarget = async (taskType) => {
    const setting = await (0, exports.resolveTaskTypeSetting)(taskType);
    if (!setting) {
        return null;
    }
    if (!setting.tg_photos_chat_id && !setting.tg_photos_topic_id) {
        return null;
    }
    return {
        chatId: setting.tg_photos_chat_id,
        topicId: setting.tg_photos_topic_id,
    };
};
exports.resolveTaskTypePhotosTarget = resolveTaskTypePhotosTarget;
exports.default = {
    resolveTaskTypeSetting: exports.resolveTaskTypeSetting,
    resolveTaskTypeTopicId: exports.resolveTaskTypeTopicId,
    resolveTaskTypePhotosTarget: exports.resolveTaskTypePhotosTarget,
    invalidateTaskTypeSettingsCache: exports.invalidateTaskTypeSettingsCache,
};
