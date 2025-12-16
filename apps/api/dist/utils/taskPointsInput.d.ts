import type { TaskPoint } from '../db/model';
export type TaskPointsErrorCode = 'points_limit_exceeded' | 'invalid_point' | 'invalid_segment';
export declare class TaskPointsValidationError extends Error {
    code: TaskPointsErrorCode;
    details?: unknown;
    constructor(code: TaskPointsErrorCode, message: string, details?: unknown);
}
export declare function prepareIncomingPoints(value: unknown): Promise<TaskPoint[]>;
