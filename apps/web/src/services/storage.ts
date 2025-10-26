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

export const attachFileToTask = async (fileId: string, taskId: string) => {
  const response = await authFetch(
    `/api/v1/files/${encodeURIComponent(fileId)}/attach`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    },
  );
  if (!response.ok) {
    const error = new Error("attach") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  try {
    return (await response.json()) as { ok?: boolean; taskId?: string };
  } catch {
    return { ok: true, taskId };
  }
};

export default { fetchFiles, fetchFile, removeFile, attachFileToTask };
