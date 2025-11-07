import { Router } from 'express';
export interface Point {
    lat: number;
    lng: number;
}
export interface DistanceBody {
    start: Point;
    end: Point;
}
export interface DistanceResponse {
    distance: number;
    route_distance_km?: number;
    [key: string]: unknown;
}
declare const router: Router;
export default router;
