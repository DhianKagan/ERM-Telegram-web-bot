// Назначение: запросы к API оркестратора стека
// Основные модули: authFetch
import authFetch from "../utils/authFetch";

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
  errors: Array<{
    message: string;
    count: number;
  }>;
  warnings: Array<{
    message: string;
    count: number;
  }>;
  recommendations: Array<{
    id: string;
    title: string;
    reason: string;
    autoRun: boolean;
    command?: string;
  }>;
  sourceFile: string;
}

export interface FileSyncSnapshot {
  totalFiles: number;
  linkedFiles: number;
  detachedFiles: number;
}

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

export const fetchOverview = () =>
  authFetch("/api/v1/system/overview").then((res) =>
    res.ok ? (res.json() as Promise<StackOverview>) : Promise.reject(res),
  );

export const executePlan = () =>
  authFetch("/api/v1/system/coordinate", { method: "POST" }).then((res) =>
    res.ok ? (res.json() as Promise<StackExecutionResult>) : Promise.reject(res),
  );

export const fetchLatestLogAnalysis = () =>
  authFetch("/api/v1/system/log-analysis/latest").then((res) =>
    res.ok ? (res.json() as Promise<RailwayLogAnalysisSummary | null>) : Promise.reject(res),
  );

export const fetchCodexBrief = () =>
  authFetch("/api/v1/system/codex-brief").then((res) =>
    res.ok ? (res.json() as Promise<CodexMaintenanceBrief>) : Promise.reject(res),
  );

export default { fetchOverview, executePlan, fetchLatestLogAnalysis, fetchCodexBrief };
