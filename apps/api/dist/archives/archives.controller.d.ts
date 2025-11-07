import { Request, Response } from 'express';
import { handleValidation } from '../utils/validate';
import type ArchivesService from './archives.service';
export default class ArchivesController {
    private service;
    constructor(service: ArchivesService);
    list: (req: Request, res: Response) => Promise<void>;
    purge: (typeof handleValidation | ((req: Request<unknown, unknown, {
        ids?: unknown;
    }>, res: Response) => Promise<void>))[];
}
