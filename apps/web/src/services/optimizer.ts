// Назначение: запрос оптимизации маршрута
// Основные модули: authFetch, shared
import type { RoutePlan } from "shared";
import authFetch from "../utils/authFetch";

export const optimizeRoute = async (
  taskIds: string[],
  count: number,
  method: string,
): Promise<RoutePlan | null> => {
  const response = await authFetch("/api/v1/optimizer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks: taskIds, count, method }),
  });
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return (data?.plan ?? null) as RoutePlan | null;
};

export default optimizeRoute;
