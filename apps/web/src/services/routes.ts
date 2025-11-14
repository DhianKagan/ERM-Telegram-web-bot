// Назначение: запрос списка маршрутов
// Основные модули: authFetch
import authFetch from '../utils/authFetch';

export const fetchRoutes = (params: Record<string, unknown> = {}) => {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v),
  );
  const q = new URLSearchParams(filtered as Record<string, string>).toString();
  const url = '/api/v1/routes/all' + (q ? `?${q}` : '');
  return authFetch(url).then((r) => (r.ok ? r.json() : []));
};

export default fetchRoutes;
