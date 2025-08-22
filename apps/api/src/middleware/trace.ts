// Назначение: обработка заголовка traceparent и генерация trace-id
// Основные модули: express, crypto
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { runWithTrace } from '../utils/trace';

function generateSpanId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

export default function trace(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.header('traceparent');
  let traceId = '';
  if (header) {
    const m = header.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/);
    if (m) traceId = m[1];
  }
  if (!traceId) {
    traceId = randomUUID().replace(/-/g, '');
  }
  const spanId = generateSpanId();
  const traceparent = `00-${traceId}-${spanId}-01`;
  runWithTrace({ traceId, traceparent }, () => {
    (req as unknown as Record<string, unknown>).traceId = traceId;
    res.setHeader('traceparent', traceparent);
    res.setHeader('x-trace-id', traceId);
    next();
  });
}
