// Назначение: HTTP-контроллер псевдо И-агента оркестратора
// Основные модули: express, tsyringe, stackOrchestrator.service
import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../di/tokens';
import StackOrchestratorService from './stackOrchestrator.service';

@injectable()
export default class StackOrchestratorController {
  constructor(
    @inject(TOKENS.StackOrchestratorService)
    private readonly service: StackOrchestratorService,
  ) {}

  overview = async (_req: Request, res: Response): Promise<void> => {
    const overview = await this.service.overview();
    res.json(overview);
  };

  coordinate = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.service.executePlan();
    res.json(result);
  };
}
