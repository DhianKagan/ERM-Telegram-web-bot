import { Request, Response } from 'express';
import { handleValidation } from '../utils/validate';
import type UsersService from './users.service';
import type { UserDocument } from '../db/model';
interface CreateUserBody {
    id?: string | number;
    username?: string;
    roleId?: string;
}
type UpdateUserBody = Omit<Partial<UserDocument>, 'access' | 'role'>;
export default class UsersController {
    private service;
    constructor(service: UsersService);
    list: (req: Request, res: Response) => Promise<void>;
    get: (req: Request<{
        id: string;
    }>, res: Response) => Promise<void>;
    create: (typeof handleValidation | ((req: Request<unknown, unknown, CreateUserBody>, res: Response) => Promise<void>))[];
    update: (typeof handleValidation | ((req: Request<{
        id: string;
    }, unknown, UpdateUserBody>, res: Response) => Promise<void>))[];
    remove: (req: Request<{
        id: string;
    }>, res: Response) => Promise<void>;
}
export {};
