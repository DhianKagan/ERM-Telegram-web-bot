import { Types } from 'mongoose';
import type { Attachment } from '../db/model';
export declare function coerceAttachments(value: unknown): Attachment[] | undefined;
export declare const extractFileIdFromUrl: (url: string | null | undefined) => string | null;
export declare const buildAttachmentsFromCommentHtml: (commentHtml: string | null | undefined, options?: {
    existing?: Attachment[] | null;
}) => Attachment[];
/**
 * Извлекает ObjectId файлов из массива вложений задачи.
 * Допускает URL вида `/api/v1/files/<id>` с дополнительными параметрами.
 */
export declare function extractAttachmentIds(attachments: Attachment[] | undefined | null): Types.ObjectId[];
