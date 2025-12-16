/**
 * Назначение файла: централизованный обработчик ошибок Express.
 * Основные модули: express, fs, path.
 */
import { Request, Response, NextFunction } from 'express';
export default function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction): void;
