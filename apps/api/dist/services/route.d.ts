import { cacheClear } from '../utils/cache';
/** Проверка формата координат */
export declare function validateCoords(value: string): string;
export interface Point {
    lat: number;
    lng: number;
}
export interface RouteDistance {
    distance: number | undefined;
    waypoints?: unknown;
}
export declare function getRouteDistance(start: Point, end: Point): Promise<RouteDistance>;
export declare function table<T = unknown>(points: string, params?: Record<string, string | number>): Promise<T>;
export declare function nearest<T = unknown>(point: string, params?: Record<string, string | number>): Promise<T>;
export declare function match<T = unknown>(points: string, params?: Record<string, string | number>): Promise<T>;
export declare function trip<T = unknown>(points: string, params?: Record<string, string | number>): Promise<T>;
/** Сборка ключа кеша */
export declare function buildCacheKey(endpoint: string, coords: string, params: Record<string, string | number>): string;
/** Очистка кеша маршрутов */
export declare const clearRouteCache: typeof cacheClear;
