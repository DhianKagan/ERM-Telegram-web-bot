// Запрос списка маршрутов
import authFetch from "../utils/authFetch";

export const fetchRoutes = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  const url = "/api/v1/routes/all" + (q ? `?${q}` : "");
  return authFetch(url).then(r => (r.ok ? r.json() : []));
};

export default fetchRoutes;
