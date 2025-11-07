import { Request, Response, NextFunction } from 'express';
import { ValidationChain } from 'express-validator';
export declare function handleValidation(req: Request, res: Response, next: NextFunction): void;
export default function validate(rules: ValidationChain[]): Array<ValidationChain | typeof handleValidation>;
