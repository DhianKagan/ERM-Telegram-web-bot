// Назначение: логирование HTTP запросов и ответов
// Основные модули: wgLogEngine
import { writeLog } from '../services/service';
import { Request, Response, NextFunction } from 'express';

export default function logging(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { method, originalUrl, headers, cookies, ip } = req;
  const tokenVal =
    cookies && cookies.token ? String(cookies.token).slice(0, 8) : 'no-token';
  const csrfVal = headers['x-xsrf-token']
    ? String(headers['x-xsrf-token']).slice(0, 8)
    : 'no-csrf';
  const ua = headers['user-agent']
    ? String(headers['user-agent']).slice(0, 40)
    : 'unknown';
  writeLog(
    `Запрос ${method} ${originalUrl} token:${tokenVal} csrf:${csrfVal} ip:${ip} ua:${ua}`,
  ).catch(() => {});
  res.on('finish', () => {
    writeLog(
      `Ответ ${method} ${originalUrl} ${res.statusCode} ip:${ip} ua:${ua}`,
    ).catch(() => {});
  });
  next();
}
