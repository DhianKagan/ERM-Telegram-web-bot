import type { Point } from '../services/route';
export type OsrmPoint = Point;
export interface OsrmDistanceParams {
    start: OsrmPoint;
    finish: OsrmPoint;
}
export declare const getOsrmDistance: (params: OsrmDistanceParams) => Promise<number | null>;
