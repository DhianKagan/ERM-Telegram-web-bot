import { HydratedDocument, Types } from 'mongoose';
import type { RoutePlanRoute, RoutePlanStatus, RoutePlanStop, RoutePlanTaskRef } from 'shared';
export type RoutePlanTaskEntry = Omit<RoutePlanTaskRef, 'taskId'> & {
    taskId: Types.ObjectId;
};
export type RoutePlanStopEntry = Omit<RoutePlanStop, 'taskId'> & {
    taskId: Types.ObjectId;
};
export type RoutePlanRouteEntry = Omit<RoutePlanRoute, 'tasks' | 'stops' | 'vehicleId'> & {
    id?: string;
    vehicleId?: Types.ObjectId | null;
    tasks: RoutePlanTaskEntry[];
    stops: RoutePlanStopEntry[];
    metrics?: {
        distanceKm?: number | null;
        tasks?: number;
        stops?: number;
        load?: number | null;
        etaMinutes?: number | null;
    };
};
export interface RoutePlanAttrs {
    title: string;
    status: RoutePlanStatus;
    suggestedBy?: number | null;
    method?: 'angle' | 'trip';
    count?: number;
    notes?: string | null;
    approvedBy?: number | null;
    approvedAt?: Date | null;
    completedBy?: number | null;
    completedAt?: Date | null;
    routes: RoutePlanRouteEntry[];
    metrics: {
        totalDistanceKm?: number | null;
        totalRoutes: number;
        totalTasks: number;
        totalStops?: number;
        totalEtaMinutes?: number | null;
        totalLoad?: number | null;
    };
    tasks: Types.ObjectId[];
}
export type RoutePlanDocument = HydratedDocument<RoutePlanAttrs>;
export declare const RoutePlan: import("mongoose").Model<RoutePlanAttrs, {}, {}, {}, import("mongoose").Document<unknown, {}, RoutePlanAttrs, {}, {}> & RoutePlanAttrs & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>;
