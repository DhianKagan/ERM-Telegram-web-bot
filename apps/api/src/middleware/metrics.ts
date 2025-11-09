// Назначение: сбор Prometheus-метрик HTTP запросов
// Основные модули: express, prom-client
import { Request, Response, NextFunction } from 'express';
import { httpRequestsTotal, httpRequestDuration } from '../metrics';

export default function metrics(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status: res.statusCode,
    };
    httpRequestsTotal.inc(labels);
    end(labels);
  });
  next();
}
