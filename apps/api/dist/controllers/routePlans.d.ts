import { Request, Response } from 'express';
import type RequestWithUser from '../types/request';
type RoutePlanUpdateRequestBody = {
    title?: unknown;
    notes?: unknown;
    routes?: unknown;
};
type RoutePlanStatusRequestBody = {
    status?: unknown;
};
export declare function list(req: Request, res: Response): Promise<void>;
export declare function detail(req: Request, res: Response): Promise<void>;
export declare function update(req: RequestWithUser<Record<string, string>, unknown, RoutePlanUpdateRequestBody>, res: Response): Promise<void>;
export declare function changeStatus(req: RequestWithUser<Record<string, string>, unknown, RoutePlanStatusRequestBody>, res: Response): Promise<void>;
export declare function remove(req: Request, res: Response): Promise<void>;
declare const _default: {
    list: typeof list;
    detail: typeof detail;
    update: typeof update;
    changeStatus: typeof changeStatus;
    remove: typeof remove;
};
export default _default;
