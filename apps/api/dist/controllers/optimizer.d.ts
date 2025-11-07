import { Response } from 'express';
import * as service from '../services/optimizer';
import type RequestWithUser from '../types/request';
type OptimizeRequestBody = {
    tasks?: unknown;
    count?: unknown;
    method?: service.OptimizeMethod;
};
export declare function optimize(req: RequestWithUser<Record<string, string>, unknown, OptimizeRequestBody>, res: Response): Promise<void>;
export {};
