// Назначение: запросы к API задач
// Основные модули: authFetch
import authFetch from "../utils/authFetch";

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

export const createTask = (data: Record<string, unknown>) =>
  authFetch("/api/v1/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  }).then(async (r) => {
    if (!r.ok) return null;
    const result = await r.json();
    const id = (result as any)._id || (result as any).id;
    if (id && (window as any).Telegram?.WebApp) {
      (window as any).Telegram.WebApp.sendData(`task_created:${id}`);
    }
    return result;
  });

export const deleteTask = (id: string) =>
  authFetch(`/api/v1/tasks/${id}`, {
    method: "DELETE",
  });

export const updateTask = (id: string, data: Record<string, unknown>) =>
  authFetch(`/api/v1/tasks/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

export const fetchMentioned = () =>
  authFetch("/api/v1/tasks/mentioned").then((r) => (r.ok ? r.json() : []));

export const fetchTasks = (params: Record<string, unknown> = {}) => {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v),
  );
  const q = new URLSearchParams(filtered as Record<string, string>).toString();
  const url = "/api/v1/tasks" + (q ? `?${q}` : "");
  const key = `tasks_${q}`;
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
    .then((r) => (r.ok ? r.json() : { tasks: [], users: [] }))
    .then((d) => {
      localStorage.setItem(key, JSON.stringify({ time: Date.now(), data: d }));
      return d;
    });
};
