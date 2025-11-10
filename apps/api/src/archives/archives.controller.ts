// Контроллер архива задач
// Основные модули: express, service архива
import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { handleValidation } from '../utils/validate';
import { TOKENS } from '../di/tokens';
import type ArchivesService from './archives.service';
import type { ArchiveListParams } from '../db/queries';

@injectable()
export default class ArchivesController {
  constructor(
    @inject(TOKENS.ArchivesService) private service: ArchivesService,
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const params: ArchiveListParams = {
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    };
    const data = await this.service.list(params);
    res.json(data);
  };

  purge = [
    handleValidation,
    async (
      req: Request<unknown, unknown, { ids?: unknown }>,
      res: Response,
    ): Promise<void> => {
      const ids = Array.isArray(req.body?.ids)
        ? (req.body.ids as unknown[])
            .map((value) => (typeof value === 'string' ? value : String(value ?? '')).trim())
            .filter((value) => value.length > 0)
        : [];
      const removed = await this.service.purge(ids);
      res.json({ removed });
    },
  ];
}
