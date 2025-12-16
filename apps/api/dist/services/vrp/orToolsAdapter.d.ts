import type { TaskLike } from '../optimizer';
export interface SolverTask extends TaskLike {
    demand?: number;
    serviceMinutes?: number;
    timeWindowMinutes?: [number, number];
}
export interface OrToolsSolveRequest {
    tasks: Array<{
        id: string;
        demand?: number;
        service_minutes?: number;
        time_window?: [number, number];
    }>;
    distance_matrix: number[][];
    vehicle_capacity?: number;
    vehicle_count?: number;
    depot_index?: number;
    time_windows?: Array<[number, number]>;
    time_limit_seconds?: number;
}
export interface OrToolsSolveResult {
    enabled: boolean;
    routes: string[][];
    totalDistanceKm: number;
    totalDurationMinutes: number;
    warnings: string[];
}
export declare const createSampleProblem: () => OrToolsSolveRequest;
export declare const solveSampleRoute: () => Promise<OrToolsSolveResult>;
export declare const solveWithOrTools: (payload: OrToolsSolveRequest) => Promise<OrToolsSolveResult>;
