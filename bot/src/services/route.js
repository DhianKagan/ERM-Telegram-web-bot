// Назначение: расчёт маршрута через сервис ORSM
// Модули: fetch, config
const { routingUrl } = require('../config')

async function getRouteDistance(start, end) {
  const url = `${routingUrl}?start=${start.lng},${start.lat}&end=${end.lng},${end.lat}`
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok || data.code !== 'Ok') {
    throw new Error(data.message || data.code || 'Route error')
  }
  return {
    distance: data.routes?.[0]?.distance,
    waypoints: data.waypoints
  }
}

module.exports = { getRouteDistance }
