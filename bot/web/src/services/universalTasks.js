// Запросы к API универсальных задач
import authFetch from "../utils/authFetch";

export const listUniversalTasks = () =>
  authFetch("/api/universal_tasks").then((r) => (r.ok ? r.json() : []));

export const createUniversalTask = (data) =>
  authFetch("/api/universal_tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => (r.ok ? r.json() : null));

export const deleteUniversalTask = (id) =>
  authFetch(`/api/universal_tasks/${id}`, { method: "DELETE" });
