// Назначение: получение маршрута через OSRM
// Основные модули: fetch
const isValidPoint = (point?: { lng: number; lat: number }) => {
  if (!point) return false;
  const { lng, lat } = point;
  return Number.isFinite(lng) && Number.isFinite(lat);
};

export const fetchRouteGeometry = async (
  start: { lng: number; lat: number },
  end: { lng: number; lat: number },
) => {
  if (!isValidPoint(start) || !isValidPoint(end)) {
    return null;
  }
  const base =
    import.meta.env.VITE_ROUTING_URL ||
    'https://router.project-osrm.org/route/v1/driving';
  const url = `${base}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.routes?.[0]?.geometry?.coordinates || null;
};

export default fetchRouteGeometry;
