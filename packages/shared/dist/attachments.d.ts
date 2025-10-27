export type AttachmentCandidate = {
    url: string;
    name?: string | null;
    thumbnailUrl?: string | null;
    uploadedBy?: number | null;
    uploadedAt?: Date | string | null;
    type?: string | null;
    size?: number | null;
};
type AttachmentPlaceholderFactory<T extends AttachmentCandidate> = (fileId: string, url: string) => T;
export declare const normalizeObjectIdCandidate: (candidate: string) => string | null;
export declare const extractIdsFromCommentHtml: (html: string | null | undefined) => string[];
export declare const extractFileIdFromUrl: (url: string | null | undefined) => string | null;
export declare const buildAttachmentsFromCommentHtml: <T extends AttachmentCandidate>(commentHtml: string | null | undefined, options?: {
    existing?: T[] | null;
    createPlaceholder?: AttachmentPlaceholderFactory<T>;
}) => T[];
export {};
