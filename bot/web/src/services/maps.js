// Запросы к API карт
import authFetch from "../utils/authFetch";

export const expandLink = (url) =>
  authFetch("/api/v1/maps/expand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  }).then((r) => (r.ok ? r.json() : null));
