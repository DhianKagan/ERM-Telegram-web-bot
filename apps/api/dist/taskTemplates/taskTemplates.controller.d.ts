import { Request, Response } from 'express';
import type TaskTemplatesService from './taskTemplates.service';
import { handleValidation } from '../utils/validate';
export default class TaskTemplatesController {
    private service;
    constructor(service: TaskTemplatesService);
    list: (_req: Request, res: Response) => Promise<void>;
    detail: (req: Request, res: Response) => Promise<void>;
    create: (typeof handleValidation)[];
}
