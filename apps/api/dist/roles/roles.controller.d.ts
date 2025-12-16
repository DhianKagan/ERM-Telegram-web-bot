import { Request, Response } from 'express';
import { handleValidation } from '../utils/validate';
import type RolesService from './roles.service';
export default class RolesController {
    private service;
    constructor(service: RolesService);
    list: (req: Request, res: Response) => Promise<void>;
    update: (typeof handleValidation)[];
}
