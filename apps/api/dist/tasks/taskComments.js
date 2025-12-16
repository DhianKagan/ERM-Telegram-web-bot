"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncCommentMessage = exports.buildCommentTelegramMessage = exports.buildCommentHtml = exports.ensureCommentHtml = exports.EMPTY_COMMENT_PLACEHOLDER_HTML = void 0;
const shared_1 = require("shared");
const formatTask_1 = require("../utils/formatTask");
const DEFAULT_TIMEZONE = shared_1.PROJECT_TIMEZONE || 'UTC';
const DEFAULT_TIMEZONE_LABEL = shared_1.PROJECT_TIMEZONE_LABEL || DEFAULT_TIMEZONE;
const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DEFAULT_TIMEZONE,
});
exports.EMPTY_COMMENT_PLACEHOLDER_HTML = '<p>Нет комментариев</p>';
const escapeHtml = (value) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const normalizeDate = (value) => {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
};
const hasRenderableComment = (value) => {
    if (typeof value !== 'string') {
        return false;
    }
    const markdown = (0, formatTask_1.convertHtmlToMarkdown)(value);
    const normalized = markdown.replace(/\u200b/gi, '').trim();
    return normalized.length > 0;
};
const ensureCommentHtml = (value) => {
    if (hasRenderableComment(value)) {
        return value;
    }
    return exports.EMPTY_COMMENT_PLACEHOLDER_HTML;
};
exports.ensureCommentHtml = ensureCommentHtml;
const buildCommentHtml = (entries, options = {}) => {
    if (!Array.isArray(entries) || entries.length === 0) {
        return '';
    }
    const blocks = [];
    entries.forEach((entry) => {
        var _a, _b;
        if (!entry || typeof entry.text !== 'string') {
            return;
        }
        const rawText = entry.text.trim();
        if (!rawText) {
            return;
        }
        const authorId = Number(entry.author_id);
        const meta = authorId in (options.users || {}) ? (_a = options.users) === null || _a === void 0 ? void 0 : _a[authorId] : undefined;
        const fallback = authorId in (options.fallbackNames || {})
            ? (_b = options.fallbackNames) === null || _b === void 0 ? void 0 : _b[authorId]
            : undefined;
        const displayName = (typeof (meta === null || meta === void 0 ? void 0 : meta.name) === 'string' && meta.name.trim()) ||
            (typeof (meta === null || meta === void 0 ? void 0 : meta.username) === 'string' && meta.username.trim()) ||
            (typeof fallback === 'string' && fallback.trim()) ||
            `ID ${Number.isFinite(authorId) ? authorId : '-'} `;
        const timestamp = normalizeDate(entry.created_at);
        const formattedTime = timestamp
            ? `${dateFormatter.format(timestamp)} (${DEFAULT_TIMEZONE_LABEL})`
            : '';
        const safeName = escapeHtml(displayName);
        const safeText = escapeHtml(rawText).replace(/\r?\n/g, '<br>');
        const header = formattedTime
            ? `<strong>${safeName}</strong> <span style="color:#64748b">${escapeHtml(formattedTime)}</span>`
            : `<strong>${safeName}</strong>`;
        blocks.push(`<p>${header}<br>${safeText}</p>`);
    });
    return blocks.join('\n');
};
exports.buildCommentHtml = buildCommentHtml;
const buildCommentTelegramMessage = (commentHtml) => {
    const source = typeof commentHtml === 'string' ? commentHtml.trim() : '';
    if (!source) {
        return null;
    }
    const markdown = (0, formatTask_1.convertHtmlToMarkdown)(source).trim();
    if (!markdown) {
        return null;
    }
    const text = `💬 *Комментарий*\n${markdown}`;
    return { text, parseMode: 'MarkdownV2' };
};
exports.buildCommentTelegramMessage = buildCommentTelegramMessage;
const syncCommentMessage = async (options) => {
    var _a, _b, _c, _d;
    const { bot, chatId, topicId, replyTo, messageId, commentHtml, detectors } = options;
    const payload = (0, exports.buildCommentTelegramMessage)(commentHtml !== null && commentHtml !== void 0 ? commentHtml : '');
    if (!payload) {
        if (typeof messageId === 'number') {
            try {
                await bot.telegram.deleteMessage(chatId, messageId);
            }
            catch (error) {
                if (!((_a = detectors === null || detectors === void 0 ? void 0 : detectors.missingOnDelete) === null || _a === void 0 ? void 0 : _a.call(detectors, error))) {
                    throw error;
                }
            }
        }
        return undefined;
    }
    const baseOptions = {
        parse_mode: payload.parseMode,
        link_preview_options: { is_disabled: true },
        ...(typeof topicId === 'number' ? { message_thread_id: topicId } : {}),
    };
    if (typeof messageId === 'number') {
        try {
            await bot.telegram.editMessageText(chatId, messageId, undefined, payload.text, baseOptions);
            return messageId;
        }
        catch (error) {
            if ((_b = detectors === null || detectors === void 0 ? void 0 : detectors.notModified) === null || _b === void 0 ? void 0 : _b.call(detectors, error)) {
                return messageId;
            }
            if ((_c = detectors === null || detectors === void 0 ? void 0 : detectors.missingOnEdit) === null || _c === void 0 ? void 0 : _c.call(detectors, error)) {
                // будем пересоздавать сообщение ниже
            }
            else {
                throw error;
            }
        }
    }
    const sendOptions = { ...baseOptions };
    if (typeof replyTo === 'number') {
        sendOptions.reply_parameters = {
            message_id: replyTo,
            allow_sending_without_reply: true,
        };
    }
    const response = await bot.telegram.sendMessage(chatId, payload.text, sendOptions);
    return (_d = response === null || response === void 0 ? void 0 : response.message_id) !== null && _d !== void 0 ? _d : undefined;
};
exports.syncCommentMessage = syncCommentMessage;
