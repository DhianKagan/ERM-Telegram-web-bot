import type { Context, Telegraf } from 'telegraf';
import type { Comment } from '../db/model';
export declare const EMPTY_COMMENT_PLACEHOLDER_HTML = "<p>\u041D\u0435\u0442 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0435\u0432</p>";
export declare const ensureCommentHtml: (value: string | null | undefined) => string;
export interface CommentAuthorMeta {
    name?: string | null;
    username?: string | null;
}
export interface BuildCommentHtmlOptions {
    users?: Record<number, CommentAuthorMeta | undefined>;
    fallbackNames?: Record<number, string | undefined>;
}
export declare const buildCommentHtml: (entries: Comment[] | undefined, options?: BuildCommentHtmlOptions) => string;
export declare const buildCommentTelegramMessage: (commentHtml: string | null | undefined) => {
    text: string;
    parseMode: "MarkdownV2";
} | null;
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
export declare const syncCommentMessage: (options: CommentSyncOptions) => Promise<number | undefined>;
