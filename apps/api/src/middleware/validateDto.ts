// Назначение файла: middleware для проверки DTO
// Основные модули: express-validator
import { validationResult } from 'express-validator';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { sendProblem } from '../utils/problem';

interface ValidatableDto {
  rules(): RequestHandler[];
}

export default function validateDto(Dto: ValidatableDto): RequestHandler[] {
  return [
    ...Dto.rules(),
    (req: Request, res: Response, next: NextFunction) => {
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
    },
  ];
}
