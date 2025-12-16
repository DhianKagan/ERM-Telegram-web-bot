import { Request, Response, NextFunction, RequestHandler } from 'express';
import type { RequestWithUser } from '../types/request';
import client from 'prom-client';
export declare const apiErrors: client.Counter<"method" | "path" | "status">;
export declare const asyncHandler: (fn: (req: Request, res: Response, next?: NextFunction) => Promise<void> | void) => RequestHandler;
export declare function verifyToken(req: RequestWithUser, res: Response, next: NextFunction): void;
export declare function requestLogger(req: RequestWithUser, res: Response, next: NextFunction): void;
declare const _default: {
    verifyToken: typeof verifyToken;
    asyncHandler: (fn: (req: Request, res: Response, next?: NextFunction) => Promise<void> | void) => RequestHandler;
    requestLogger: typeof requestLogger;
    apiErrors: client.Counter<"method" | "path" | "status">;
};
export default _default;
