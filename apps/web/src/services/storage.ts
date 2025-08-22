// Назначение: запросы к API хранения файлов
// Основные модули: authFetch
import authFetch from "../utils/authFetch";

export const fetchFiles = () =>
  authFetch("/api/v1/storage").then((r) => (r.ok ? r.json() : []));

export const removeFile = (name: string) =>
  authFetch(`/api/v1/storage/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });

export default { fetchFiles, removeFile };
