// Формирование ссылки маршрута Google Maps из последовательности точек (до 10)
export default function createMultiRouteLink(points = [], mode = 'driving') {
  if (!Array.isArray(points) || points.length < 2) return ''
  const pts = points.slice(0, 10)
  const origin = pts[0]
  const destination = pts[pts.length - 1]
  const waypoints = pts.slice(1, -1).map(p => `${p.lat},${p.lng}`).join('|')
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=${mode}`
  if (waypoints) url += `&waypoints=${waypoints}`
  return url
}
