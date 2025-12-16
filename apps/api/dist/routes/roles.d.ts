import { Router } from 'express';
export interface RoleUpdateParams {
    id: string;
}
export interface RolesResponse {
    roles: unknown[];
}
export interface UpdateRoleBody {
    access: number;
}
export interface UpdateRoleResponse {
    status: string;
}
declare const router: Router;
export default router;
