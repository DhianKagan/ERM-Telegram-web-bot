// Назначение файла: middleware для проверки DTO
// Основные модули: express-validator
import { validationResult } from 'express-validator';
import { Request, Response, NextFunction, RequestHandler } from 'express';

interface ValidatableDto {
  rules(): RequestHandler[];
}

export default function validateDto(Dto: ValidatableDto): RequestHandler[] {
  return [
    ...Dto.rules(),
    (req: Request, res: Response, next: NextFunction) => {
      const errors = validationResult(req);
      if (errors.isEmpty()) return next();
      res.status(400).json({ errors: errors.array() });
    },
  ];
}
module.exports = validateDto;
