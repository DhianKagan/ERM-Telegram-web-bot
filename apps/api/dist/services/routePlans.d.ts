import { Types } from 'mongoose';
import { type RoutePlan as SharedRoutePlan, type RoutePlanStatus } from 'shared';
interface TaskSource {
    _id: Types.ObjectId | string | {
        toString(): string;
    };
    title?: string;
    startCoordinates?: {
        lat?: number;
        lng?: number;
    } | null;
    finishCoordinates?: {
        lat?: number;
        lng?: number;
    } | null;
    start_location?: string | null;
    end_location?: string | null;
    route_distance_km?: number | null;
}
export interface RoutePlanRouteInput {
    id?: string;
    order?: number;
    vehicleId?: string | null;
    vehicleName?: string | null;
    driverId?: number | string | null;
    driverName?: string | null;
    notes?: string | null;
    tasks: string[];
}
export interface RoutePlanUpdatePayload {
    title?: string;
    notes?: string | null;
    routes?: RoutePlanRouteInput[];
}
export interface RoutePlanListFilters {
    status?: RoutePlanStatus;
    page?: number;
    limit?: number;
}
export interface CreateRoutePlanOptions {
    actorId?: number;
    method?: 'angle' | 'trip';
    count?: number;
    title?: string;
    notes?: string | null;
}
export declare function createDraftFromInputs(routes: RoutePlanRouteInput[], options?: CreateRoutePlanOptions, taskHints?: Iterable<TaskSource>): Promise<SharedRoutePlan>;
export declare function listPlans(filters?: RoutePlanListFilters): Promise<{
    items: SharedRoutePlan[];
    total: number;
}>;
export declare function getPlan(id: string): Promise<SharedRoutePlan | null>;
export declare function updatePlan(id: string, payload: RoutePlanUpdatePayload): Promise<SharedRoutePlan | null>;
export declare function updatePlanStatus(id: string, status: RoutePlanStatus, actorId?: number): Promise<SharedRoutePlan | null>;
export declare function removePlan(id: string): Promise<boolean>;
export type RoutePlanTaskHint = TaskSource;
declare const _default: {
    createDraftFromInputs: typeof createDraftFromInputs;
    listPlans: typeof listPlans;
    getPlan: typeof getPlan;
    updatePlan: typeof updatePlan;
    updatePlanStatus: typeof updatePlanStatus;
    removePlan: typeof removePlan;
};
export default _default;
