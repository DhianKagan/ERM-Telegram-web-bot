import type { TaskFilters } from '../db/queries';
import type { TaskKind } from '../db/model';
export interface FilterNormalizationResult {
    normalized: TaskFilters;
    statusValues: string[];
    taskTypeValues: string[];
    assigneeValues: number[];
    kindFilter?: TaskKind;
}
export declare function parseStringList(value: unknown): string[];
export declare function parseAssigneeList(value: unknown): number[];
export declare function normalizeTaskFilters(filters: Record<string, unknown>): FilterNormalizationResult;
