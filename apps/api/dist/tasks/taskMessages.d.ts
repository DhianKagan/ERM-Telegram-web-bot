import type { HistoryEntry, TaskDocument } from '../db/model';
type TaskIdentifierSource = Partial<Pick<TaskDocument, '_id' | 'request_id' | 'task_number'>> & Record<string, unknown>;
export declare function getTaskIdentifier(task: TaskIdentifierSource): string;
export declare function buildActionMessage(task: TaskIdentifierSource, action: string, at: Date, creatorId?: number): Promise<string>;
export declare function buildLatestHistorySummary(task: TaskIdentifierSource & {
    history?: HistoryEntry[];
} & Record<string, unknown>): Promise<string | null>;
export declare function buildHistorySummaryLog(task: TaskIdentifierSource & {
    history?: HistoryEntry[];
} & Record<string, unknown>): Promise<string | null>;
export {};
