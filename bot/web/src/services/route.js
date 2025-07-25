// Запрос к API /api/v1/route для расчёта дистанции
// Модули: authFetch
import authFetch from "../utils/authFetch";

export const fetchRoute = async (start, end) => {
  await fetch("/api/v1/csrf", { credentials: "include" }).catch(() => {});
  const res = await authFetch("/api/v1/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, end })
  });
  return res.ok ? res.json() : null;
};
export default fetchRoute;

