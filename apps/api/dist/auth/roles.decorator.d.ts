export declare const ROLES_KEY: unique symbol;
import { Request, Response, NextFunction } from 'express';
export declare function Roles(mask: number): (req: Request, _res: Response, next: NextFunction) => void;
declare const _default: {
    Roles: typeof Roles;
    ROLES_KEY: symbol;
};
export default _default;
