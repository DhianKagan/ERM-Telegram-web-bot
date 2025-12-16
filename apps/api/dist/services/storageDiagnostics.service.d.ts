import type { Model } from 'mongoose';
import type { FileDocument } from '../db/model';
import { getFileSyncSnapshot } from './dataStorage';
export interface StorageDiagnosticsReport {
    generatedAt: string;
    snapshot: Awaited<ReturnType<typeof getFileSyncSnapshot>>;
    detachedFiles: Array<{
        id: string;
        name: string;
        path: string;
        size: number;
        uploadedAt: Date;
        userId: number;
    }>;
}
export interface StorageRemediationResultItem {
    action: string;
    status: 'completed' | 'skipped' | 'failed';
    details?: string;
    attempted?: number;
    repaired?: number;
    errors?: number;
}
export interface StorageRemediationReport {
    generatedAt: string;
    results: StorageRemediationResultItem[];
    report: StorageDiagnosticsReport;
}
export default class StorageDiagnosticsService {
    private readonly fileModel;
    constructor(fileModel: Model<FileDocument>);
    private get detachedFilter();
    private restoreDetachedLinks;
    private generateReport;
    diagnose(): Promise<StorageDiagnosticsReport>;
    remediate(): Promise<StorageRemediationReport>;
}
