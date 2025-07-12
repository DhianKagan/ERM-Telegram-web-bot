// Оптимизация маршрутов по координатам задач
// Модули: db/queries
const q = require('../db/queries')

async function optimize(taskIds, count = 1) {
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
  const routes = []
  for (let i = 0; i < count; i++) {
    const slice = sorted.slice(i * step, (i + 1) * step)
    routes.push(slice.map(t => t._id.toString()))
  }
  return routes
}

module.exports = { optimize }
