import { Response, NextFunction } from 'express';
import type { RequestWithUser } from '../types/request';
export default function checkTaskAccess(req: RequestWithUser, res: Response, next: NextFunction): Promise<void>;
