// Назначение файла: валидация запросов через express-validator
// Основные модули: express-validator
import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { sendProblem } from './problem';

export function handleValidation(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const errorList = errors.array();
  sendProblem(req, res, {
    type: 'about:blank',
    title: 'Ошибка валидации',
    status: 400,
    detail: 'Ошибка валидации',
    errors: errorList,
  });
}

export default function validate(
  rules: ValidationChain[],
): Array<ValidationChain | typeof handleValidation> {
  return [...rules, handleValidation];
}
