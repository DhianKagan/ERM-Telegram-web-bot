import { Router } from 'express';
export interface RoutesQuery {
    from?: string;
    to?: string;
    status?: string;
}
export interface RoutesResponse {
    routes: unknown[];
}
declare const router: Router;
export default router;
