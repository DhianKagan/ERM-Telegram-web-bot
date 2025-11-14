// Назначение: расчёт дистанции маршрута через API
// Основные модули: authFetch
import authFetch from '../utils/authFetch';

interface Point {
  lat: number;
  lng: number;
}

export const fetchRoute = async (start: Point, end: Point) => {
  const res = await authFetch('/api/v1/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start, end }),
  });
  return res.ok ? res.json() : null;
};

export default fetchRoute;
