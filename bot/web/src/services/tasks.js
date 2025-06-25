// Запросы к API задач
export const fetchKanban = () =>
  fetch("/api/tasks?kanban=true", {
    headers: {
      Authorization: localStorage.token ? `Bearer ${localStorage.token}` : "",
    },
  }).then((r) => (r.ok ? r.json() : []));

export const updateTaskStatus = (id, status) =>
  fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: localStorage.token ? `Bearer ${localStorage.token}` : "",
    },
    body: JSON.stringify({ status }),
  });

export const createTask = (data) =>
  fetch("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: localStorage.token ? `Bearer ${localStorage.token}` : "",
    },
    body: JSON.stringify(data),
  }).then((r) => (r.ok ? r.json() : null));

export const deleteTask = (id) =>
  fetch(`/api/tasks/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: localStorage.token ? `Bearer ${localStorage.token}` : "",
    },
  });

export const updateTask = (id, data) =>
  fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: localStorage.token ? `Bearer ${localStorage.token}` : "",
    },
    body: JSON.stringify(data),
  });
