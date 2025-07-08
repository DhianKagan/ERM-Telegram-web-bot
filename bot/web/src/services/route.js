// Запрос к API /api/v1/route для расчёта дистанции
// Модули: authFetch
import authFetch from "../utils/authFetch";

export const fetchRoute = (start, end) =>
  authFetch("/api/v1/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, end })
  }).then((r) => (r.ok ? r.json() : null));

export default fetchRoute;

