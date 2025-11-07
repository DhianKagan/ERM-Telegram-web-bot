import type RequestWithUser from '../types/request';
export type UploadContext = {
    id: string;
    dir: string;
    userId: number;
};
export declare const getTempUploadsRoot: () => string;
export declare const ensureUploadContext: (req: RequestWithUser, userId: number) => UploadContext;
export declare const getUploadContext: (req: RequestWithUser) => UploadContext | undefined;
export declare const clearUploadContext: (req: RequestWithUser) => void;
