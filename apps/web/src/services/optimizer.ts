// Назначение: запрос оптимизации маршрута
// Основные модули: authFetch
import authFetch from "../utils/authFetch";

export const optimizeRoute = (
  taskIds: string[],
  count: number,
  method: string,
) =>
  authFetch("/api/v1/optimizer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks: taskIds, count, method }),
  }).then((r) => (r.ok ? r.json() : null));

export default optimizeRoute;
