export interface RailwayLogIssueSummary {
    message: string;
    count: number;
    samples?: string[];
    context?: string[];
}
export interface RailwayLogRecommendation {
    id: string;
    title: string;
    reason: string;
    autoRun: boolean;
    command?: string;
}
export interface RailwayLogAnalysisSummary {
    generatedAt: string;
    baseName: string;
    logPath: string;
    stats: {
        totalLines: number;
        errors: number;
        warnings: number;
        infos: number;
    };
    errors: RailwayLogIssueSummary[];
    warnings: RailwayLogIssueSummary[];
    recommendations: RailwayLogRecommendation[];
    sourceFile: string;
}
export default class LogAnalysisService {
    private readonly analysisDir;
    getLatestSummary(): Promise<RailwayLogAnalysisSummary | null>;
}
