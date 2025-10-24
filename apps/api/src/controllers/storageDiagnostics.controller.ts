// Контроллер диагностики файлового хранилища
// Основные модули: express, tsyringe, services/storageDiagnostics.service
import { Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '../di/tokens';
import StorageDiagnosticsService from '../services/storageDiagnostics.service';

@injectable()
export default class StorageDiagnosticsController {
  constructor(
    @inject(TOKENS.StorageDiagnosticsService)
    private readonly service: StorageDiagnosticsService,
  ) {}

  diagnose = async (_req: Request, res: Response): Promise<void> => {
    const report = await this.service.diagnose();
    res.json(report);
  };

  remediate = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.service.remediate();
    res.json(result);
  };
}
