// apps/api/src/middleware/requestLogger.ts
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../services/wgLogEngine';

/**
 * Request logger middleware.
 * - Generates a requestId (uses X-Request-Id header if present)
 * - Logs incoming request with sanitized headers
 * - Logs finish event with status and duration
 * - Logs aborted requests
 *
 * This implementation uses Node's built-in crypto.randomUUID() to avoid
 * adding the 'uuid' package as a dependency.
 */

function sanitizeHeaders(h: Record<string, unknown> | undefined) {
  if (!h) return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(h)) {
    const low = key.toLowerCase();
    out[key] = low === 'authorization' ? '<REDACTED>' : h[key];
  }
  return out;
}

export default function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const headerReqId =
    typeof req.headers['x-request-id'] === 'string'
      ? (req.headers['x-request-id'] as string)
      : undefined;
  const requestId = headerReqId || randomUUID();

  // attach requestId for downstream usage
  const reqWithId = req as Request & { requestId?: string };
  reqWithId.requestId = requestId;

  const start = Date.now();

  // log incoming request
  try {
    logger.info(
      {
        reqId: requestId,
        method: req.method,
        url: req.originalUrl,
        headers: sanitizeHeaders(req.headers as Record<string, unknown>),
      },
      'Incoming HTTP request',
    );
  } catch (err) {
    // avoid breaking request on logging error
    console.error('Failed to log incoming request', err);
  }

  // when response finishes, log status and duration
  res.on('finish', () => {
    const duration = Date.now() - start;
    try {
      logger.info(
        {
          reqId: requestId,
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          durationMs: duration,
        },
        'Request finished',
      );
    } catch (err) {
      console.error('Failed to log finished request', err);
    }
  });

  // if request aborted by client (connection closed), log warn
  req.on('aborted', () => {
    const duration = Date.now() - start;
    try {
      logger.warn(
        {
          reqId: requestId,
          method: req.method,
          url: req.originalUrl,
          durationMs: duration,
        },
        'Request aborted by client',
      );
    } catch (err) {
      console.error('Failed to log aborted request', err);
    }
  });

  next();
}
