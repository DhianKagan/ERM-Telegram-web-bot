// Назначение: утилиты форматирования комментариев задач и синхронизации с Telegram
// Основные модули: telegraf, shared, utils/formatTask
import type { Context, Telegraf } from 'telegraf';
import { PROJECT_TIMEZONE, PROJECT_TIMEZONE_LABEL } from 'shared';
import type { Comment } from '../db/model';
import { convertHtmlToMarkdown } from '../utils/formatTask';

const DEFAULT_TIMEZONE = PROJECT_TIMEZONE || 'UTC';
const DEFAULT_TIMEZONE_LABEL = PROJECT_TIMEZONE_LABEL || DEFAULT_TIMEZONE;

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: DEFAULT_TIMEZONE,
});

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

export interface CommentAuthorMeta {
  name?: string | null;
  username?: string | null;
}

export interface BuildCommentHtmlOptions {
  users?: Record<number, CommentAuthorMeta | undefined>;
  fallbackNames?: Record<number, string | undefined>;
}

export const buildCommentHtml = (
  entries: Comment[] | undefined,
  options: BuildCommentHtmlOptions = {},
): string => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return '';
  }
  const blocks: string[] = [];
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
    const displayName =
      (typeof meta?.name === 'string' && meta.name.trim()) ||
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

export const buildCommentTelegramMessage = (
  commentHtml: string | null | undefined,
): { text: string; parseMode: 'MarkdownV2' } | null => {
  const source = typeof commentHtml === 'string' ? commentHtml.trim() : '';
  if (!source) {
    return null;
  }
  const markdown = convertHtmlToMarkdown(source).trim();
  if (!markdown) {
    return null;
  }
  const text = `💬 *Комментарий*\n${markdown}`;
  return { text, parseMode: 'MarkdownV2' };
};

export interface CommentSyncErrorDetectors {
  notModified?: (error: unknown) => boolean;
  missingOnEdit?: (error: unknown) => boolean;
  missingOnDelete?: (error: unknown) => boolean;
}

export interface CommentSyncOptions {
  bot: Telegraf<Context>;
  chatId: string | number;
  topicId?: number;
  replyTo?: number;
  messageId?: number | null;
  commentHtml?: string | null;
  detectors?: CommentSyncErrorDetectors;
}

type SendMessageOptions = Parameters<Telegraf<Context>['telegram']['sendMessage']>[2];

export const syncCommentMessage = async (
  options: CommentSyncOptions,
): Promise<number | undefined> => {
  const { bot, chatId, topicId, replyTo, messageId, commentHtml, detectors } = options;
  const payload = buildCommentTelegramMessage(commentHtml ?? '');
  if (!payload) {
    if (typeof messageId === 'number') {
      try {
        await bot.telegram.deleteMessage(chatId, messageId);
      } catch (error) {
        if (!detectors?.missingOnDelete?.(error)) {
          throw error;
        }
      }
    }
    return undefined;
  }

  const commonOptions: SendMessageOptions = {
    parse_mode: payload.parseMode,
    link_preview_options: { is_disabled: true },
    ...(typeof topicId === 'number' ? { message_thread_id: topicId } : {}),
  };

  if (typeof messageId === 'number') {
    try {
      await bot.telegram.editMessageText(
        chatId,
        messageId,
        undefined,
        payload.text,
        commonOptions,
      );
      return messageId;
    } catch (error) {
      if (detectors?.notModified?.(error)) {
        return messageId;
      }
      if (detectors?.missingOnEdit?.(error)) {
        // будем пересоздавать сообщение ниже
      } else {
        throw error;
      }
    }
  }

  const sendOptions: SendMessageOptions = { ...commonOptions };
  if (typeof replyTo === 'number') {
    sendOptions.reply_parameters = {
      message_id: replyTo,
      allow_sending_without_reply: true,
    };
  }
  const response = await bot.telegram.sendMessage(chatId, payload.text, sendOptions);
  return response?.message_id ?? undefined;
};
