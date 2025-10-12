// Назначение: запросы к API оркестратора стека
// Основные модули: authFetch
import authFetch from "../utils/authFetch";
import type {
  StorageDiagnosticsReport,
  StorageFixAction,
} from "./storage";

export interface StackOverview {
  generatedAt: string;
  storage: StorageDiagnosticsReport;
  plannedActions: StorageFixAction[];
}

export interface StackExecutionResult {
  generatedAt: string;
  plan: StorageFixAction[];
  execution: {
    performed: Array<{ action: StorageFixAction; details?: Record<string, unknown> }>;
    errors: Array<{ action: StorageFixAction; error: string }>;
  };
  report: StorageDiagnosticsReport;
}

export const fetchOverview = () =>
  authFetch("/api/v1/system/overview").then((res) =>
    res.ok ? (res.json() as Promise<StackOverview>) : Promise.reject(res),
  );

export const executePlan = () =>
  authFetch("/api/v1/system/coordinate", { method: "POST" }).then((res) =>
    res.ok ? (res.json() as Promise<StackExecutionResult>) : Promise.reject(res),
  );

export default { fetchOverview, executePlan };
