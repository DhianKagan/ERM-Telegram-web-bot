// Назначение файла: валидация запросов через express-validator
// Основные модули: express-validator
import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

export function handleValidation(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  res.status(400).json({ errors: errors.array() });
}

export default function validate(
  rules: ValidationChain[],
): Array<ValidationChain | typeof handleValidation> {
  return [...rules, handleValidation];
}

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
(module as any).exports = validate;
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
(module as any).exports.handleValidation = handleValidation;
