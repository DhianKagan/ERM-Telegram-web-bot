// Запросы к API справочников
import authFetch from "../utils/authFetch";

export const fetchDefaults = (name) =>
  authFetch(`/api/v1/defaults/${name}`).then((r) => (r.ok ? r.json() : []));

export const updateDefaults = (name, values) =>
  authFetch(`/api/v1/defaults/${name}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });

export const fetchTransports = () =>
  authFetch("/api/v1/transports").then((r) => (r.ok ? r.json() : []));

export const fetchDepartments = () =>
  authFetch("/api/v1/departments").then((r) => (r.ok ? r.json() : []));

export const createDepartment = (name) =>
  authFetch("/api/v1/departments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

export const updateDepartment = (id, name) =>
  authFetch(`/api/v1/departments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

export const deleteDepartment = (id) =>
  authFetch(`/api/v1/departments/${id}`, { method: "DELETE" });
