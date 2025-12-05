// apps/worker/src/utils/debugLogger.ts
// Worker-side debug logger for outbound route calls.
// Uses the worker's local pino logger to avoid cross-package imports.

import { logger } from '../logger';

export function logOutboundRouteCall(opts: {
  url: string;
  headers?: Record<string, unknown>;
  start?: number;
  resStatus?: number;
  resBody?: unknown;
  error?: unknown;
  reqId?: string;
}) {
  const duration = opts.start ? Date.now() - opts.start : undefined;
  const safeBody =
    typeof opts.resBody === 'string' && opts.resBody.length > 1000
      ? opts.resBody.slice(0, 1000) + '...[truncated]'
      : opts.resBody;
  logger.info(
    {
      reqId: opts.reqId,
      url: opts.url,
      durationMs: duration,
      reqHeaders: maskHeaders(opts.headers),
      resStatus: opts.resStatus,
      resBody: safeBody,
      err: opts.error
        ? opts.error instanceof Error
          ? { name: (opts.error as Error).name, message: (opts.error as Error).message }
          : opts.error
        : undefined,
    },
    'Worker outbound route call',
  );
}

function maskHeaders(h?: Record<string, unknown>) {
  if (!h) return h;
  const out: any = {};
  for (const k of Object.keys(h)) {
    if (k.toLowerCase() === 'authorization') out[k] = '<REDACTED>';
    else out[k] = h[k];
  }
  return out;
}
