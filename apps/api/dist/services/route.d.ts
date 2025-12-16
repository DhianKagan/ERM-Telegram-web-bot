import type { Position } from 'geojson';
import { cacheClear } from '../utils/cache';
export declare function validateCoords(value: string): string;
export declare function normalizePointsString(raw: string): Array<[number, number]>;
/** Haversine */
export declare function haversineDistanceMeters(a: [number, number], b: [number, number]): number;
export interface Point {
    lat: number;
    lng: number;
}
export interface RouteDistance {
    distance: number | undefined;
    waypoints?: unknown;
}
export interface RouteGeometryResponse {
    routes?: Array<{
        geometry?: {
            coordinates?: Position[];
        } | null;
    }>;
}
export declare function getRouteDistance(start: Point, end: Point): Promise<RouteDistance>;
export declare function routeGeometry(points: string, params?: Record<string, string | number>): Promise<Position[] | null>;
export declare function table<T = unknown>(points: string, params?: Record<string, string | number>): Promise<T>;
export declare function nearest<T = unknown>(point: string, params?: Record<string, string | number>): Promise<T>;
export declare function match<T = unknown>(points: string, params?: Record<string, string | number>): Promise<T>;
export declare function trip<T = unknown>(points: string, params?: Record<string, string | number>): Promise<T>;
export declare function buildCacheKey(endpoint: string, coords: string, params: Record<string, string | number>): string;
export declare const clearRouteCache: typeof cacheClear;
