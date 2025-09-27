// Назначение: типы описания ошибок в формате RFC 9457
// Основные модули: express-validator
import type { ValidationError } from 'express-validator';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  errors?: ValidationError[];
}
