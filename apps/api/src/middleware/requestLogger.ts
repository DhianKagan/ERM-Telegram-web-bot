// apps/api/src/middleware/requestLogger.ts
import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../services/wgLogEngine';

/**
 * Simple request logger that attaches requestId and logs request start/finish.
 * Compatible with existing pino logger in repo. Does NOT log sensitive Authorization header.
 */

function sanitizeHeaders(h: Record<string, unknown> | undefined) {
  if (!h) return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(h)) {
    const low = key.toLowerCase();
    if (low === 'authorization') {
      out[key] = '<REDACTED>';
    } else {
      out[key] = (h as any)[key];
    }
  }
  return out;
}

export default function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  // attach for downstream usage
  (req as any).requestId = requestId;

  const start = Date.now();
  // short info when request comes in
  logger.info(
    { reqId: requestId, method: req.method, url: req.originalUrl, headers: sanitizeHeaders(req.headers as any) },
    'Incoming HTTP request'
  );

  // when finished, log status and duration
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(
      { reqId: requestId, method: req.method, url: req.originalUrl, status: res.statusCode, durationMs: duration },
      'Request finished'
    );
  });

  // if aborted by client, log as warn
  req.on('aborted', () => {
    const duration = Date.now() - start;
    logger.warn({ reqId: requestId, method: req.method, url: req.originalUrl, durationMs: duration }, 'Request aborted by client');
  });

  next();
}
