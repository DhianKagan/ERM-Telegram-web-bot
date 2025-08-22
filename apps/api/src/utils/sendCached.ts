// Назначение файла: отправка JSON с ETag и заголовками кеширования
// Основные модули: crypto, express
import { createHash } from 'crypto';
import type { Request, Response } from 'express';

export function sendCached<
  P extends Record<string, unknown>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = unknown,
>(
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response,
  data: unknown,
): void {
  const body = JSON.stringify(data);
  const etag = createHash('sha256').update(body).digest('hex');
  res.setHeader('Cache-Control', 'max-age=60, stale-while-revalidate=120');
  res.setHeader('ETag', etag);
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }
  res.json(data);
}
