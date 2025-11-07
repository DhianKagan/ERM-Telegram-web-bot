import { Types } from 'mongoose';
import type { Request } from 'express';
import type RequestWithUser from '../types/request';
declare const TEMP_URL_PREFIX = "temp://";
type AttachmentLike = {
    name?: string;
    url?: string;
    thumbnailUrl?: string;
    uploadedBy?: number;
    uploadedAt?: Date | string;
    type?: string;
    size?: number;
};
export declare const isTemporaryUrl: (value: unknown) => value is string;
type FinalizeOptions = {
    req: Request & RequestWithUser;
    taskId?: string | Types.ObjectId;
    draftId?: string | Types.ObjectId;
    attachments?: AttachmentLike[];
};
type FinalizeResult = {
    attachments: AttachmentLike[];
    created: AttachmentLike[];
    fileIds: string[];
};
export declare const finalizePendingUploads: (options: FinalizeOptions) => Promise<FinalizeResult>;
export declare const purgeTemporaryUploads: (req: Request) => Promise<void>;
export type { AttachmentLike };
export { TEMP_URL_PREFIX };
