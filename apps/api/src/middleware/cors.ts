// apps/api/src/middleware/cors.ts
import type { Request, Response, NextFunction } from 'express';

function parseOrigins(): string[] {
  const list = (process.env.APP_ORIGINS || process.env.APP_ORIGIN || '')
    .split(/[,s]+/)
    .map(s => s.trim())
    .filter(Boolean);
  return Array.from(new Set(list));
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origins = parseOrigins();
  const origin = req.headers.origin as string | undefined;

  res.setHeader('Vary', 'Origin');

  if (origin && (origins.length === 0 || origins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Разрешённые заголовки/методы
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] as string || 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', req.headers['access-control-request-method'] as string || 'GET,POST,PUT,PATCH,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}
