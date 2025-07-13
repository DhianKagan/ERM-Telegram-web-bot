// Запросы к API задач
import authFetch from "../utils/authFetch";

export const fetchKanban = () =>
  authFetch("/api/v1/tasks?kanban=true").then((r) => (r.ok ? r.json() : []));

export const updateTaskStatus = (id, status) =>
  authFetch(`/api/v1/tasks/${id}/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

export const createTask = (data) =>
  authFetch("/api/v1/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  }).then(async (r) => {
    if (!r.ok) return null;
    const result = await r.json();
    const id = result._id || result.id;
    if (id && window.Telegram?.WebApp) {
      window.Telegram.WebApp.sendData(`task_created:${id}`);
    }
    return result;
  });

export const deleteTask = (id) =>
  authFetch(`/api/v1/tasks/${id}`, {
    method: "DELETE",
  });

export const updateTask = (id, data) =>
  authFetch(`/api/v1/tasks/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

export const fetchMentioned = () =>
  authFetch('/api/v1/tasks/mentioned').then(r=> (r.ok ? r.json() : []))

export const fetchTasks = (params = {}) => {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v)
  )
  const q = new URLSearchParams(filtered).toString()
  const url = '/api/v1/tasks' + (q ? `?${q}` : '')
  return authFetch(url).then(r => (r.ok ? r.json() : []))
}

