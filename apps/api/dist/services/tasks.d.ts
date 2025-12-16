import type { TaskDocument } from '../db/model';
/**
 * TaskData — частичный объект задачи. Используем TaskDocument для полей схемы.
 * startCoordinates/finishCoordinates остаются информационными (если присутствуют).
 * Явно добавляем поля, допускающие `null`, чтобы совместить с shared.Task.
 */
export type TaskData = Partial<TaskDocument> & {
    completed_at?: string | Date | null;
    startCoordinates?: unknown;
    finishCoordinates?: unknown;
    points?: unknown;
    google_route_url?: string | null;
    route_distance_km?: number | null;
    due_date?: Date;
    remind_at?: Date;
    start_location?: string | null;
    end_location?: string | null;
    start_location_link?: string | null;
    end_location_link?: string | null;
    [key: string]: unknown;
};
export declare const create: (data?: TaskData, userId?: number) => Promise<unknown>;
export declare const get: (filters: Record<string, unknown>, page: number, limit: number) => Promise<unknown>;
export declare const getById: (id: string) => Promise<unknown>;
export declare const update: (id: string, data?: TaskData, userId?: number) => Promise<unknown>;
export declare const addTime: (id: string, minutes: number, userId?: number) => Promise<unknown>;
export declare const bulk: (ids: string[], data?: TaskData) => Promise<unknown>;
export declare const summary: (filters: Record<string, unknown>) => Promise<unknown>;
export declare const remove: (id: string) => Promise<unknown>;
export declare const mentioned: (userId: number) => Promise<unknown>;
