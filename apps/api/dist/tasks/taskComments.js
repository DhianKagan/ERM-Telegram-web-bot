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
        if (!entry || typeof entry.text !== 'string') {
            return;
        }
        const rawText = entry.text.trim();
        if (!rawText) {
            return;
        }
        const authorId = Number(entry.author_id);
        const meta = authorId in (options.users || {}) ? options.users?.[authorId] : undefined;
        const fallback = authorId in (options.fallbackNames || {}) ? options.fallbackNames?.[authorId] : undefined;
        const displayName = (typeof meta?.name === 'string' && meta.name.trim()) ||
            (typeof meta?.username === 'string' && meta.username.trim()) ||
            (typeof fallback === 'string' && fallback.trim()) ||
            `ID ${Number.isFinite(authorId) ? authorId : '-'} `;
        const timestamp = normalizeDate(entry.created_at);
        const formattedTime = timestamp ? `${dateFormatter.format(timestamp)} (${DEFAULT_TIMEZONE_LABEL})` : '';
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
    const { bot, chatId, topicId, replyTo, messageId, commentHtml, detectors } = options;
    const payload = (0, exports.buildCommentTelegramMessage)(commentHtml ?? '');
    if (!payload) {
        if (typeof messageId === 'number') {
            try {
                await bot.telegram.deleteMessage(chatId, messageId);
            }
            catch (error) {
                if (!detectors?.missingOnDelete?.(error)) {
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
            if (detectors?.notModified?.(error)) {
                return messageId;
            }
            if (detectors?.missingOnEdit?.(error)) {
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
    return response?.message_id ?? undefined;
};
exports.syncCommentMessage = syncCommentMessage;
