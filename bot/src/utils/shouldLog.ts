// Назначение: фильтрация запросов для записи логов.
// Модули: express
import { Request } from 'express';

const patterns: { regex: RegExp; methods: string[] }[] = [
  { regex: /^\/api\/v1\/tasks/, methods: ['POST', 'PATCH', 'DELETE'] },
  { regex: /^\/api\/v1\/auth\/profile$/, methods: ['PATCH'] },
  { regex: /^\/api\/auth\/tma-login$/, methods: ['POST'] },
  { regex: /^\/api\/v1\/auth\/verify_code$/, methods: ['POST'] },
];

export default function shouldLog(req: Request): boolean {
  if (req.originalUrl.startsWith('/api/v1/logs')) return false;
  return patterns.some(
    ({ regex, methods }) =>
      regex.test(req.originalUrl) && methods.includes(req.method),
  );
}
