// Назначение файла: валидация запросов через express-validator
// Основные модули: express-validator
import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

export function handleValidation(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  res.status(400).json({ errors: errors.array() });
}

export default function validate(
  rules: ValidationChain[],
): Array<ValidationChain | typeof handleValidation> {
  return [...rules, handleValidation];
}
