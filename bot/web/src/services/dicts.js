// Запросы к API справочников
import authFetch from "../utils/authFetch";

export const fetchDefaults = (name) =>
  authFetch(`/api/defaults/${name}`).then((r) => (r.ok ? r.json() : []));

export const updateDefaults = (name, values) =>
  authFetch(`/api/defaults/${name}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });

export const fetchTransports = () =>
  authFetch("/api/transports").then((r) => (r.ok ? r.json() : []));
