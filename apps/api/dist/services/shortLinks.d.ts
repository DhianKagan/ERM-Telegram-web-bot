export declare const getShortLinkPathPrefix: () => string;
export declare const getShortLinkBase: () => string | null;
export declare const buildShortLink: (slug: string) => string;
export declare const extractSlug: (input: string) => string | null;
export declare const isShortLink: (input: string) => boolean;
export declare const resolveShortLink: (input: string) => Promise<string | null>;
export declare const ensureShortLink: (url: string) => Promise<{
    shortUrl: string;
    slug: string;
}>;
export declare const resolveShortLinkBySlug: (slug: string) => Promise<string | null>;
