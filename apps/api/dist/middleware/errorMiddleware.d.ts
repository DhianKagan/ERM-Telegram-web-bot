import { Response, NextFunction } from 'express';
import type { RequestWithUser } from '../types/request';
export default function errorMiddleware(err: unknown, req: RequestWithUser, res: Response, _next: NextFunction): void;
