// Оптимизация маршрутов по координатам задач
// Модули: db/queries, utils/haversine
const q = require('../db/queries')
const dist = require('../utils/haversine')

async function optimize(taskIds, count = 1) {
  count = Math.max(1, Math.min(3, Number(count) || 1))
  const tasks = (await Promise.all(taskIds.map(id => q.getTask(id))))
    .filter(t => t && t.startCoordinates)
  if (!tasks.length) return []
  const vehicles = Array.from({ length: count }, () => ({
    pos: tasks[0].startCoordinates,
    route: []
  }))
  const remaining = [...tasks]
  while (remaining.length) {
    for (const v of vehicles) {
      if (!remaining.length) break
      let best = 0
      let bestDist = Infinity
      for (let i = 0; i < remaining.length; i++) {
        const d = dist(v.pos, remaining[i].startCoordinates)
        if (d < bestDist) { bestDist = d; best = i }
      }
      const [task] = remaining.splice(best, 1)
      v.route.push(task._id.toString())
      v.pos = task.finishCoordinates || task.startCoordinates
    }
  }
  return vehicles.map(v => v.route)
}

module.exports = { optimize }
