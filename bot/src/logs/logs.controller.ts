// Контроллер логов с использованием LogsService
// Основные модули: express-validator, express
import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { handleValidation } from '../utils/validate';
import { TOKENS } from '../di/tokens';
import type LogsService from './logs.service';
import { ListLogParams } from '../services/wgLogEngine';

@injectable()
export default class LogsController {
  constructor(@inject(TOKENS.LogsService) private service: LogsService) {}

  list = async (
    req: Request<unknown, unknown, unknown, ListLogParams>,
    res: Response,
  ): Promise<void> => {
    res.json(await this.service.list(req.query));
  };

  create = [
    handleValidation,
    async (
      req: Request<unknown, unknown, { message?: string }>,
      res: Response,
    ): Promise<void> => {
      if (typeof req.body.message === 'string') {
        await this.service.write(req.body.message);
      }
      res.json({ status: 'ok' });
    },
  ];
}
