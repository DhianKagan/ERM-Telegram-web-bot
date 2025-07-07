// Назначение: расчёт маршрута по координатам через сервис erm-map
// Модули: fetch, config
const { routingUrl } = require('../config')

async function getRouteDistance(start, end) {
  const res = await fetch(routingUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orig_lat: start.lat,
      orig_lon: start.lng,
      dest_lat: end.lat,
      dest_lon: end.lng
    })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return {
    distance: data.distance_m,
    nodes: data.route_nodes
  }
}

module.exports = { getRouteDistance }
