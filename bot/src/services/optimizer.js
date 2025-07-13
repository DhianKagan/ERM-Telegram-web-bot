// Оптимизация маршрутов по координатам задач
// Модули: db/queries, services/route
const q = require('../db/queries')
const route = require('./route')

async function optimize(taskIds, count = 1, method = 'angle') {
  count = Math.max(1, Math.min(3, Number(count) || 1))
  const tasks = (await Promise.all(taskIds.map(id => q.getTask(id))))
    .filter(t => t && t.startCoordinates)
  if (!tasks.length) return []
  count = Math.min(count, tasks.length)

  const center = {
    lat: tasks.reduce((s, t) => s + t.startCoordinates.lat, 0) / tasks.length,
    lng: tasks.reduce((s, t) => s + t.startCoordinates.lng, 0) / tasks.length
  }

  const angle = t =>
    Math.atan2(t.startCoordinates.lat - center.lat,
      t.startCoordinates.lng - center.lng)

  const sorted = tasks.sort((a, b) => angle(a) - angle(b))
  const step = Math.ceil(sorted.length / count)
  const groups = []
  for (let i = 0; i < count; i++) {
    groups.push(sorted.slice(i * step, (i + 1) * step))
  }

  if (method === 'trip') {
    const routes = []
    for (const g of groups) {
      if (g.length < 2) {
        routes.push(g.map(t => t._id.toString()))
        continue
      }
      const points = g
        .map(t => `${t.startCoordinates.lng},${t.startCoordinates.lat}`)
        .join(';')
      try {
        const data = await route.trip(points, { roundtrip: false })
        const ordered = data.trips?.[0]?.waypoints
          ? data.trips[0].waypoints.map(wp => g[wp.waypoint_index])
          : g
        routes.push(ordered.map(t => t._id.toString()))
      } catch {
        routes.push(g.map(t => t._id.toString()))
      }
    }
    return routes
  }

  return groups.map(g => g.map(t => t._id.toString()))
}

module.exports = { optimize }
