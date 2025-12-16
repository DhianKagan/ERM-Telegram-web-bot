import { Request, Response } from 'express';
import StackOrchestratorService from './stackOrchestrator.service';
export default class StackOrchestratorController {
    private readonly service;
    constructor(service: StackOrchestratorService);
    overview: (_req: Request, res: Response) => Promise<void>;
    coordinate: (_req: Request, res: Response) => Promise<void>;
    latestLogAnalysis: (_req: Request, res: Response) => Promise<void>;
    codexBrief: (_req: Request, res: Response) => Promise<void>;
}
