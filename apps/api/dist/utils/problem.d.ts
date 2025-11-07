import { Request, Response } from 'express';
import { ProblemDetails } from '../types/problem';
export declare function sendProblem(req: Request, res: Response, problem: Omit<ProblemDetails, 'instance'>): void;
