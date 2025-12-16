import LogAnalysisService, { type RailwayLogAnalysisSummary } from './logAnalysis.service';
import { type FileSyncSnapshot } from '../services/dataStorage';
export interface StackOverview {
    generatedAt: string;
    fileSync: FileSyncSnapshot;
    logAnalysis: RailwayLogAnalysisSummary | null;
}
export interface StackExecutionResult {
    generatedAt: string;
    fileSync: FileSyncSnapshot;
    logAnalysis: RailwayLogAnalysisSummary | null;
}
export interface CodexMaintenanceBrief {
    generatedAt: string;
    prompt: string;
    fileSync: FileSyncSnapshot;
    logAnalysis: RailwayLogAnalysisSummary | null;
}
export default class StackOrchestratorService {
    private readonly logAnalysis;
    constructor(logAnalysis: LogAnalysisService);
    private collectSnapshot;
    overview(): Promise<StackOverview>;
    executePlan(): Promise<StackExecutionResult>;
    latestLogAnalysis(): Promise<RailwayLogAnalysisSummary | null>;
    codexBrief(): Promise<CodexMaintenanceBrief>;
}
