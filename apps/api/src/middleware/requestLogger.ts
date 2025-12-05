// apps/api/src/middleware/requestLogger.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../services/wgLogEngine';

/**
 * Middleware: assigns requestId, logs request/response metadata and timing.
 * Usage: app.use(requestLogger);
 */
export default function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] || uuidv4();
  // Attach to request for downstream logging
  (req as any).requestId = requestId;

  const start = Date.now();

  // Log incoming request short info
  logger.info(
    { reqId: requestId, method: req.method, url: req.originalUrl, headers: sanitizeHeaders(req.headers) },
    'Incoming HTTP request'
  );

  // Capture response finish to log status and duration
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(
      { reqId: requestId, method: req.method, url: req.originalUrl, status: res.statusCode, durationMs: duration },
      'Request finished'
    );
  });

  next();
}

function sanitizeHeaders(h: any) {
  // Avoid logging sensitive Authorization values; but keep X-Proxy-Token for diagnostics if present
  const out: any = {};
  for (const k of Object.keys(h)) {
    if (k.toLowerCase() === 'authorization') {
      out[k] = '<REDACTED>';
    } else {
      out[k] = h[k];
    }
  }
  return out;
}
