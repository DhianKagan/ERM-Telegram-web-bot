import { Request, Response } from 'express';
import StorageDiagnosticsService from '../services/storageDiagnostics.service';
export default class StorageDiagnosticsController {
    private readonly service;
    constructor(service: StorageDiagnosticsService);
    diagnose: (_req: Request, res: Response) => Promise<void>;
    remediate: (_req: Request, res: Response) => Promise<void>;
}
