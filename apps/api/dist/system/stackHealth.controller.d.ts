import { Request, Response } from 'express';
import StackHealthService from './stackHealth.service';
export default class StackHealthController {
    private readonly service;
    constructor(service: StackHealthService);
    run: (_req: Request, res: Response) => Promise<void>;
}
