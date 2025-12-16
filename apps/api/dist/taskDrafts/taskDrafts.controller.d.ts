import type { Response } from 'express';
import TaskDraftsService from './taskDrafts.service';
import type { RequestWithUser } from '../types/request';
export default class TaskDraftsController {
    private readonly service;
    constructor(service: TaskDraftsService);
    get: (req: RequestWithUser, res: Response) => Promise<void>;
    save: (req: RequestWithUser, res: Response) => Promise<void>;
    remove: (req: RequestWithUser, res: Response) => Promise<void>;
}
