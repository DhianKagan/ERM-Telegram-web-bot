import type { TaskDocument, TaskPoint } from '../db/model';
import { type LatLng } from './geo';
type TaskPointTarget = Partial<TaskDocument> & {
    points?: unknown;
    startCoordinates?: unknown;
    finishCoordinates?: unknown;
    start_location?: unknown;
    end_location?: unknown;
    google_route_url?: unknown;
};
export declare const normalizeTaskPoints: (value: unknown) => TaskPoint[];
export declare const syncTaskPoints: (target: TaskPointTarget) => void;
export declare const extractLegacyCoordinates: (points?: TaskPoint[] | null) => {
    start?: LatLng;
    finish?: LatLng;
};
export {};
