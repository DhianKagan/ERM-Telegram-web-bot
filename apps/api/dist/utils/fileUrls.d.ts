export interface FileUrlOptions {
    inline?: boolean;
    thumbnail?: boolean;
}
export declare const buildFileUrl: (id: unknown, options?: FileUrlOptions) => string;
export declare const buildInlineFileUrl: (id: unknown) => string;
export declare const buildThumbnailUrl: (id: unknown) => string;
