// Запросы к API задач
import authFetch from "../utils/authFetch";

export const fetchKanban = () =>
  authFetch("/api/tasks?kanban=true").then((r) => (r.ok ? r.json() : []));

export const updateTaskStatus = (id, status) =>
  authFetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

export const createTask = (data) =>
  authFetch("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  }).then((r) => (r.ok ? r.json() : null));

export const deleteTask = (id) =>
  authFetch(`/api/tasks/${id}`, {
    method: "DELETE",
  });

export const updateTask = (id, data) =>
  authFetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
