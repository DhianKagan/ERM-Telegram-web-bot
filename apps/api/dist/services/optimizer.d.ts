import type { RoutePlan as SharedRoutePlan } from 'shared';
import { type TravelMatrixResult } from './vrp/graphhopperAdapter';
import { type OrToolsSolveRequest, type OrToolsSolveResult } from './vrp/orToolsAdapter';
export type OptimizeMethod = 'angle' | 'trip';
export interface TaskLike {
    _id: {
        toString(): string;
    };
    startCoordinates?: {
        lat: number;
        lng: number;
    };
    finishCoordinates?: {
        lat: number;
        lng: number;
    };
    start_location?: string | null;
    end_location?: string | null;
    route_distance_km?: number | null;
    title?: string;
}
export interface OptimizeTaskInput {
    id: string;
    coordinates: {
        lat: number;
        lng: number;
    };
    weight?: number;
    serviceMinutes?: number;
    timeWindow?: [number, number];
}
export interface OptimizeDepotOptions {
    id?: string;
    coordinates: {
        lat: number;
        lng: number;
    };
    serviceMinutes?: number;
    timeWindow?: [number, number];
}
export interface OptimizeOptions {
    vehicleCapacity?: number;
    vehicleCount?: number;
    averageSpeedKmph?: number;
    timeLimitSeconds?: number;
    depot?: OptimizeDepotOptions;
}
export interface OptimizeRouteResult {
    taskIds: string[];
    load: number;
    etaMinutes: number;
    distanceKm: number;
}
export interface OptimizeResult {
    routes: OptimizeRouteResult[];
    totalLoad: number;
    totalEtaMinutes: number;
    totalDistanceKm: number;
    warnings: string[];
}
interface MatrixBuilderOptions {
    averageSpeedKmph: number;
}
type MatrixBuilder = (points: Array<{
    lat: number;
    lng: number;
}>, options: MatrixBuilderOptions) => Promise<TravelMatrixResult>;
type OrToolsSolver = (payload: OrToolsSolveRequest) => Promise<OrToolsSolveResult>;
export declare function optimize(first: OptimizeTaskInput[] | string[], second?: number | OptimizeOptions, method?: OptimizeMethod, actorId?: number): Promise<OptimizeResult | SharedRoutePlan | null>;
export declare const __testing: {
    setMatrixBuilder(builder: MatrixBuilder | undefined): void;
    setOrToolsSolver(solver: OrToolsSolver | undefined): void;
    reset(): void;
};
export {};
