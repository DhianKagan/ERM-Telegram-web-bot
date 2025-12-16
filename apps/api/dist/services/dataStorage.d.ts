import { Types } from 'mongoose';
import { type Attachment } from '../db/model';
export interface StoredFile {
    id: string;
    taskId?: string;
    userId: number;
    name: string;
    path: string;
    thumbnailUrl?: string;
    type: string;
    size: number;
    uploadedAt: Date;
    url: string;
    previewUrl: string;
    taskNumber?: string;
    taskTitle?: string;
}
export declare const collectAttachmentLinks: (candidates: Array<{
    id: string;
    hasTask: boolean;
}>) => Promise<Map<string, {
    taskId: string;
    number?: string | null;
    title?: string | null;
}>>;
export declare function listFiles(filters?: {
    userId?: number;
    type?: string;
}): Promise<StoredFile[]>;
export declare function getFile(id: string): Promise<StoredFile | null>;
export interface DeleteFileResult {
    taskId?: string;
    attachments?: Attachment[];
}
export declare function deleteFile(identifier: string): Promise<DeleteFileResult | undefined>;
export declare function deleteFilesForTask(taskId: Types.ObjectId | string, extraFileIds?: Types.ObjectId[]): Promise<void>;
export declare function removeDetachedFilesOlderThan(cutoff: Date): Promise<number>;
export interface FileSyncSnapshot {
    totalFiles: number;
    linkedFiles: number;
    detachedFiles: number;
}
export declare function getFileSyncSnapshot(): Promise<FileSyncSnapshot>;
