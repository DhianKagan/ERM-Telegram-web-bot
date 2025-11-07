import type { Context, Telegraf } from 'telegraf';
import { type TaskDocument } from '../db/model';
import type { FormatTaskSection, InlineImage } from '../utils/formatTask';
type LocalPhotoInfo = {
    absolutePath: string;
    filename: string;
    contentType?: string;
    size?: number;
};
type NormalizedAttachment = {
    kind: 'image';
    url: string;
    caption?: string;
} | {
    kind: 'unsupported-image';
    url: string;
    caption?: string;
    mimeType?: string;
    name?: string;
    size?: number;
} | {
    kind: 'youtube';
    url: string;
    title?: string;
};
type NormalizedImage = Extract<NormalizedAttachment, {
    kind: 'image';
}>;
type TaskMedia = {
    previewImage: NormalizedImage | null;
    extras: NormalizedAttachment[];
    collageCandidates: NormalizedImage[];
};
type TaskMessageSendResult = {
    messageId: number | undefined;
    usedPreview: boolean;
    cache: Map<string, LocalPhotoInfo | null>;
    previewSourceUrls?: string[];
    previewMessageIds?: number[];
    consumedAttachmentUrls?: string[];
};
type TaskTelegramMediaOptions = {
    baseAppUrl: string;
};
export declare class TaskTelegramMedia {
    private readonly bot;
    private readonly options;
    private readonly attachmentsBaseUrl;
    private readonly baseAppHost;
    private readonly botApiPhotoErrorPatterns;
    constructor(bot: Telegraf<Context>, options: TaskTelegramMediaOptions);
    collectSendableAttachments(task: Partial<TaskDocument>, inline: InlineImage[] | undefined): TaskMedia;
    sendTaskMessageWithPreview(chat: string | number, message: string, sections: FormatTaskSection[], media: TaskMedia, keyboardMarkup: Parameters<typeof this.bot.telegram.editMessageReplyMarkup>[3] | undefined, topicId?: number, options?: {
        skipAlbum?: boolean;
    }): Promise<TaskMessageSendResult>;
    sendTaskAttachments(chat: string | number, attachments: NormalizedAttachment[], topicId?: number, replyTo?: number, cache?: Map<string, LocalPhotoInfo | null>): Promise<number[]>;
    deleteAttachmentMessages(chat: string | number, messageIds: number[]): Promise<void>;
    private normalizeInlineImages;
    private extractLocalFileId;
    private resolvePhotoInputWithCache;
    private ensurePhotoWithinLimit;
    private createCompressedPhoto;
    private resolveLocalPhotoInfo;
    private extractPhotoErrorCode;
    private isMessageNotModifiedError;
    private isMessageMissingOnDeleteError;
}
export type { TaskMedia, TaskMessageSendResult, NormalizedAttachment, LocalPhotoInfo, };
