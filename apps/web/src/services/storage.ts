// Назначение: запросы к API хранения файлов
// Основные модули: authFetch
import authFetch from "../utils/authFetch";

export interface StoredFile {
  path: string;
  userId: number;
  name: string;
  type: string;
  url: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  size?: number;
  uploadedAt?: string;
  taskId?: string | number | null;
  taskNumber?: string | null;
  taskTitle?: string | null;
}

export type StorageIssueType =
  | "missing_on_disk"
  | "orphan_on_disk"
  | "duplicate_entry"
  | "stale_task_link";

export interface StorageFixAction {
  type: "remove_file_entry" | "delete_disk_file" | "unlink_task_reference";
  fileId?: string;
  path?: string;
  taskId?: string;
  attachmentUrl?: string;
}

export interface StorageIssue {
  type: StorageIssueType;
  fileId?: string;
  path?: string;
  size?: number;
  tasks?: { id: string; number?: string | null; title?: string | null }[];
  fileIds?: string[];
  task?: { id: string; number?: string | null; title?: string | null };
  attachmentUrl?: string;
}

export interface StorageDiagnosticsReport {
  scannedAt: string;
  stats: {
    databaseEntries: number;
    diskFiles: number;
    diskSizeBytes: number;
    diskFreeBytes?: number;
    diskTotalBytes?: number;
    thresholdBytes: number;
  };
  issues: StorageIssue[];
  summary: Record<StorageIssueType, number> & { total: number };
  recommendations: string[];
  recommendedFixes: StorageFixAction[];
}

export interface StorageFixExecution {
  performed: Array<{ action: StorageFixAction; details?: Record<string, unknown> }>;
  errors: Array<{ action: StorageFixAction; error: string }>;
}

export interface StorageFixResponse {
  result: StorageFixExecution;
  report: StorageDiagnosticsReport;
}

export const fetchFiles = (params?: { userId?: number; type?: string }) => {
  const qs = new URLSearchParams();
  if (params?.userId) qs.set("userId", String(params.userId));
  if (params?.type) qs.set("type", params.type);
  const url = `/api/v1/storage${qs.toString() ? `?${qs}` : ""}`;
  return authFetch(url).then((r) => (r.ok ? r.json() : [])) as Promise<
    StoredFile[]
  >;
};

export const removeFile = (name: string) =>
  authFetch(`/api/v1/storage/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });

export const runDiagnostics = () =>
  authFetch(`/api/v1/storage/diagnostics`).then((res) =>
    res.ok ? (res.json() as Promise<StorageDiagnosticsReport>) : Promise.reject(res),
  );

export const applyFixes = (actions: StorageFixAction[]) =>
  authFetch(`/api/v1/storage/diagnostics/fix`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actions }),
  }).then((res) =>
    res.ok
      ? (res.json() as Promise<StorageFixResponse>)
      : Promise.reject(res),
  );

export default { fetchFiles, removeFile, runDiagnostics, applyFixes };
