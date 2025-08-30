// Назначение: запросы к API задач
// Основные модули: authFetch, buildTaskFormData
import authFetch from "../utils/authFetch";
import { buildTaskFormData } from "./buildTaskFormData";

export const fetchKanban = () =>
  authFetch("/api/v1/tasks?kanban=true")
    .then((r) => (r.ok ? r.json() : []))
    .then((data) => (Array.isArray(data) ? data : data.tasks || []));

export const updateTaskStatus = (id: string, status: string) =>
  authFetch(`/api/v1/tasks/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

export const createTask = (
  data: Record<string, unknown>,
  files?: FileList | File[],
  onProgress?: (e: ProgressEvent) => void,
) => {
  const body = buildTaskFormData(data, files);
  return authFetch("/api/v1/tasks", { method: "POST", body, onProgress }).then(
    async (r) => {
      if (!r.ok) return null;
      const result = (await r.json()) as { _id?: string; id?: string };
      const id = result._id || result.id;
      if (id && window.Telegram?.WebApp) {
        window.Telegram.WebApp.sendData(`task_created:${id}`);
      }
      return result;
    },
  );
};

export const deleteTask = (id: string) =>
  authFetch(`/api/v1/tasks/${id}`, {
    method: "DELETE",
  });

export const updateTask = (
  id: string,
  data: Record<string, unknown>,
  files?: FileList | File[],
  onProgress?: (e: ProgressEvent) => void,
) => {
  const body = buildTaskFormData(data, files);
  return authFetch(`/api/v1/tasks/${id}`, {
    method: "PATCH",
    body,
    onProgress,
  });
};

export const fetchMentioned = () =>
  authFetch("/api/v1/tasks/mentioned").then((r) => (r.ok ? r.json() : []));

export const fetchTasks = (
  params: Record<string, unknown> = {},
  userId?: number,
) => {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null),
  );
  const q = new URLSearchParams(filtered as Record<string, string>).toString();
  const url = "/api/v1/tasks" + (q ? `?${q}` : "");
  const key = `tasks_${userId ?? "anon"}_${q}`;
  let cached: { time?: number; data?: unknown };
  try {
    cached = JSON.parse(localStorage.getItem(key) || "");
  } catch {
    // игнорируем ошибку парсинга
    cached = {};
  }
  if (cached.time && Date.now() - cached.time < 60000) {
    return Promise.resolve(cached.data);
  }
  return authFetch(url)
    .then((r) => (r.ok ? r.json() : { tasks: [], users: [], total: 0 }))
    .then((d) => {
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ time: Date.now(), data: d }),
        );
      } catch {
        // игнорируем переполнение
      }
      return d;
    });
};
