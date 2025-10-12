// Назначение: HTTP-контроллер диагностики хранилища
// Основные модули: express, tsyringe, storageDiagnostics.service
import { Request, Response, NextFunction, type RequestHandler } from 'express';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../di/tokens';
import StorageDiagnosticsService from './storageDiagnostics.service';
import { sendProblem } from '../utils/problem';

@injectable()
export default class StorageDiagnosticsController {
  constructor(
    @inject(TOKENS.StorageDiagnosticsService)
    private readonly service: StorageDiagnosticsService,
  ) {}

  diagnose = async (_req: Request, res: Response): Promise<void> => {
    const report = await this.service.runDiagnostics();
    res.json(report);
  };

  remediate: RequestHandler = async (
    req,
    res,
    _next: NextFunction,
  ): Promise<void> => {
    const actions = this.service.normalizeFixActions(
      (req.body as { actions?: unknown })?.actions,
    );
    if (!actions.length) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Не указаны действия',
        status: 400,
        detail: 'Передайте список действий для исправления.',
      });
      return;
    }
    const result = await this.service.applyFixes(actions);
    const report = await this.service.runDiagnostics();
    res.json({ result, report });
  };
}
