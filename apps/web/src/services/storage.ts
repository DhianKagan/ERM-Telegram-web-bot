// Назначение: запросы к API хранения файлов
// Основные модули: authFetch
import authFetch from "../utils/authFetch";

export interface StoredFile {
  id: string;
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

export interface StorageDiagnosticsReport {
  generatedAt: string;
  snapshot: {
    totalFiles: number;
    linkedFiles: number;
    detachedFiles: number;
  };
  detachedFiles: Array<{
    id: string;
    name: string;
    path: string;
    size: number;
    uploadedAt: string;
    userId: number;
  }>;
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

export const fetchFile = (id: string) =>
  authFetch(`/api/v1/storage/${encodeURIComponent(id)}`).then((res) =>
    res.ok ? (res.json() as Promise<StoredFile>) : Promise.reject(res),
  );

export const removeFile = (id: string) =>
  authFetch(`/api/v1/storage/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

export const runDiagnostics = async (): Promise<StorageDiagnosticsReport> => {
  const response = await authFetch(`/api/v1/storage/diagnostics`);
  if (!response.ok) {
    throw new Error("diagnostics");
  }
  return (await response.json()) as StorageDiagnosticsReport;
};

export default { fetchFiles, fetchFile, removeFile, runDiagnostics };

