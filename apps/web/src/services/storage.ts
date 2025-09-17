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

export default { fetchFiles, removeFile };
