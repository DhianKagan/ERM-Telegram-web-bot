// Назначение: псевдо И-агент, координирующий обслуживание стека
// Основные модули: storageDiagnostics.service, di/tokens
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../di/tokens';
import StorageDiagnosticsService, {
  type StorageDiagnosticsReport,
  type StorageFixAction,
  type StorageFixExecution,
} from '../storage/storageDiagnostics.service';
import LogAnalysisService, {
  type RailwayLogAnalysisSummary,
} from './logAnalysis.service';

export interface StackOverview {
  generatedAt: string;
  storage: StorageDiagnosticsReport;
  plannedActions: StorageFixAction[];
  logAnalysis: RailwayLogAnalysisSummary | null;
}

export interface StackExecutionResult {
  generatedAt: string;
  plan: StorageFixAction[];
  execution: StorageFixExecution;
  report: StorageDiagnosticsReport;
  logAnalysis: RailwayLogAnalysisSummary | null;
}

@injectable()
export default class StackOrchestratorService {
  constructor(
    @inject(TOKENS.StorageDiagnosticsService)
    private readonly storageDiagnostics: StorageDiagnosticsService,
    @inject(TOKENS.LogAnalysisService)
    private readonly logAnalysis: LogAnalysisService,
  ) {}

  async overview(): Promise<StackOverview> {
    const report = await this.storageDiagnostics.runDiagnostics();
    const plan = this.storageDiagnostics.buildFixPlan(report);
    const logAnalysis = await this.logAnalysis.getLatestSummary();
    return {
      generatedAt: new Date().toISOString(),
      storage: report,
      plannedActions: plan,
      logAnalysis,
    };
  }

  async executePlan(): Promise<StackExecutionResult> {
    const report = await this.storageDiagnostics.runDiagnostics();
    const plan = this.storageDiagnostics.buildFixPlan(report);
    const execution = await this.storageDiagnostics.applyFixes(plan);
    const updatedReport = await this.storageDiagnostics.runDiagnostics();
    const logAnalysis = await this.logAnalysis.getLatestSummary();
    return {
      generatedAt: new Date().toISOString(),
      plan,
      execution,
      report: updatedReport,
      logAnalysis,
    };
  }

  async latestLogAnalysis(): Promise<RailwayLogAnalysisSummary | null> {
    return this.logAnalysis.getLatestSummary();
  }
}
