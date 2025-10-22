// Назначение файла: валидация запросов через express-validator
// Основные модули: express-validator
import { Request, Response, NextFunction } from 'express';
import {
  validationResult,
  ValidationChain,
  ValidationError,
} from 'express-validator';
import { sendProblem } from './problem';
import { cleanupUploadedFiles } from './requestUploads';

const hasFieldParam = (
  error: ValidationError,
): error is ValidationError & { param: string } =>
  typeof (error as { param?: unknown }).param === 'string';

const hasFieldPath = (
  error: ValidationError,
): error is ValidationError & { path: string } =>
  typeof (error as { path?: unknown }).path === 'string';

const hasNestedErrors = (
  error: ValidationError,
): error is ValidationError & { nestedErrors: ValidationError[] } =>
  Array.isArray((error as { nestedErrors?: unknown }).nestedErrors);

const getParamName = (error: ValidationError): string => {
  if (hasFieldPath(error)) {
    return error.path.trim();
  }
  if (hasFieldParam(error)) {
    return error.param.trim();
  }
  if (hasNestedErrors(error)) {
    for (const nested of error.nestedErrors) {
      const param = getParamName(nested);
      if (param) {
        return param;
      }
    }
  }
  return '';
};

export function handleValidation(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const errorList = errors.array();
  const detailMessages = errorList
    .map((error) => {
      const param = getParamName(error);
      const rawMessage = (error as { msg?: unknown }).msg;
      const message =
        typeof rawMessage === 'string'
          ? rawMessage.trim()
          : rawMessage != null
            ? String(rawMessage).trim()
            : '';
      if (param && message) {
        return `${param} — ${message}`;
      }
      if (message) {
        return message;
      }
      return null;
    })
    .filter((value): value is string => Boolean(value));
  const detail =
    detailMessages.length > 0
      ? `Поля: ${detailMessages.join('; ')}`
      : 'Ошибка валидации';
  void cleanupUploadedFiles(req);
  sendProblem(req, res, {
    type: 'about:blank',
    title: 'Ошибка валидации',
    status: 400,
    detail,
    errors: errorList,
  });
}

export default function validate(
  rules: ValidationChain[],
): Array<ValidationChain | typeof handleValidation> {
  return [...rules, handleValidation];
}
