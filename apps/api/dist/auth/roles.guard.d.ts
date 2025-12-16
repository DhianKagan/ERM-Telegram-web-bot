import type { RequestWithUser } from '../types/request';
import { Response, NextFunction } from 'express';
export default function rolesGuard(req: RequestWithUser, res: Response, next: NextFunction): void;
