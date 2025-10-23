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

export interface StorageRemediationResultItem {
  action: string;
  status: "completed" | "skipped" | "failed";
  details?: string;
  removed?: number;
  attempted?: number;
}

export interface StorageRemediationReport {
  generatedAt: string;
  results: StorageRemediationResultItem[];
  report?: unknown;
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

export const purgeDetachedFiles = async (): Promise<StorageRemediationReport> => {
  const res = await authFetch("/api/v1/storage/diagnostics/fix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actions: [{ type: "purgeDetachedFiles" }] }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Не удалось очистить хранилище.");
  }
  return res.json() as Promise<StorageRemediationReport>;
};

export default { fetchFiles, fetchFile, removeFile, purgeDetachedFiles };
