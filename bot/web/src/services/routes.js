// Запрос списка маршрутов
import authFetch from "../utils/authFetch";

export const fetchRoutes = (params = {}) => {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v)
  );
  const q = new URLSearchParams(filtered).toString();
  const url = "/api/v1/routes/all" + (q ? `?${q}` : "");
  return authFetch(url).then(r => (r.ok ? r.json() : []));
};

export default fetchRoutes;
