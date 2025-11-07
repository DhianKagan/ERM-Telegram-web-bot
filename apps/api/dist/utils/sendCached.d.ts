import type { Request, Response } from 'express';
export declare function sendCached<P extends Record<string, unknown>, ResBody = unknown, ReqBody = unknown, ReqQuery = unknown>(req: Request<P, ResBody, ReqBody, ReqQuery>, res: Response, data: unknown): void;
