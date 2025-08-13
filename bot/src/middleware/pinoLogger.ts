// Назначение: логирование HTTP запросов через pino
// Основные модули: pino, pino-http
import type { Request } from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';

export default pinoHttp({
  logger: pino(),
  genReqId: (req: Request) => {
    const header = req.headers['traceparent'];
    if (typeof header === 'string') {
      const [, traceId, spanId] = header.split('-');
      if (traceId && spanId) return `${traceId}-${spanId}`;
    }
    return undefined;
  },
  customProps: (req: Request) => ({
    ip: req.ip,
    ua: req.headers['user-agent'],
  }),
});
