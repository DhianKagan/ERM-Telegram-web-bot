import { Response, NextFunction } from 'express';
import type { RequestWithUser } from '../types/request';
type Expected = number | string | string[];
export default function checkRole(expected: Expected): (req: RequestWithUser, res: Response, next: NextFunction) => void;
export {};
