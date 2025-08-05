// Назначение: запросы к API карт
// Основные модули: authFetch
import authFetch from "../utils/authFetch";

export const expandLink = (url: string) =>
  authFetch("/api/v1/maps/expand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  }).then((r) => (r.ok ? r.json() : null));
