// Назначение: логирование HTTP запросов через pino
// Основные модули: pino-http, services/wgLogEngine
import type { Request, RequestHandler, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import pinoHttp from 'pino-http';

import { logger as appLogger } from '../services/wgLogEngine';

const httpLogger: Logger = appLogger.child({ component: 'http' });

const middleware: RequestHandler = pinoHttp({
  logger: httpLogger,
  genReqId: (req: Request): string => {
    const header = req.headers['traceparent'];
    if (typeof header === 'string') {
      const [, traceId, spanId] = header.split('-');
      if (traceId && spanId) return `${traceId}-${spanId}`;
    }
    return randomUUID();
  },
  customProps: (req: Request) => ({
    ip: req.ip,
    ua: req.headers['user-agent'],
    method: req.method,
    path: req.originalUrl,
  }),
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (_req: Request, res: Response) =>
    `HTTP ${res.statusCode}`,
  customErrorMessage: (_req: Request, res: Response, err: Error) =>
    `HTTP ${res.statusCode}: ${err.message}`,
}) as unknown as RequestHandler;

export default middleware;
