// Сервис работы с OSRM для получения маршрута
// Модули: fetch
export const fetchRouteGeometry = async (start, end) => {
  const base = import.meta.env.VITE_ROUTING_URL ||
    'https://router.project-osrm.org/route/v1/driving'
  const url = `${base}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  return data.routes?.[0]?.geometry?.coordinates || null
}
export default fetchRouteGeometry
