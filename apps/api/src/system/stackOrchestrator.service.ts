// Назначение: псевдо И-агент, координирующий обслуживание стека
// Основные модули: storageDiagnostics.service, di/tokens
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../di/tokens';
import StorageDiagnosticsService, {
  type StorageDiagnosticsReport,
  type StorageFixAction,
  type StorageFixExecution,
} from '../storage/storageDiagnostics.service';

export interface StackOverview {
  generatedAt: string;
  storage: StorageDiagnosticsReport;
  plannedActions: StorageFixAction[];
}

export interface StackExecutionResult {
  generatedAt: string;
  plan: StorageFixAction[];
  execution: StorageFixExecution;
  report: StorageDiagnosticsReport;
}

@injectable()
export default class StackOrchestratorService {
  constructor(
    @inject(TOKENS.StorageDiagnosticsService)
    private readonly storageDiagnostics: StorageDiagnosticsService,
  ) {}

  async overview(): Promise<StackOverview> {
    const report = await this.storageDiagnostics.runDiagnostics();
    const plan = this.storageDiagnostics.buildFixPlan(report);
    return {
      generatedAt: new Date().toISOString(),
      storage: report,
      plannedActions: plan,
    };
  }

  async executePlan(): Promise<StackExecutionResult> {
    const report = await this.storageDiagnostics.runDiagnostics();
    const plan = this.storageDiagnostics.buildFixPlan(report);
    const execution = await this.storageDiagnostics.applyFixes(plan);
    const updatedReport = await this.storageDiagnostics.runDiagnostics();
    return {
      generatedAt: new Date().toISOString(),
      plan,
      execution,
      report: updatedReport,
    };
  }
}
