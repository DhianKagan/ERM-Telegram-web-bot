// Контроллер логов с использованием LogsService
// Основные модули: express-validator, container, express
import { Request, Response } from 'express';
import { handleValidation } from '../utils/validate';
import container from '../container';
import LogsService from './logs.service';
import { ListLogParams } from '../services/wgLogEngine';

const service = container.resolve<LogsService>('LogsService');

export const list = async (
  req: Request<unknown, unknown, unknown, ListLogParams>,
  res: Response,
): Promise<void> => {
  res.json(await service.list(req.query));
};

export const create = [
  handleValidation,
  async (
    req: Request<unknown, unknown, { message?: string }>,
    res: Response,
  ): Promise<void> => {
    if (typeof req.body.message === 'string') {
      await service.write(req.body.message);
    }
    res.json({ status: 'ok' });
  },
];
