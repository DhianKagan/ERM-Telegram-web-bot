// Назначение: расчёт маршрута по координатам
// Модули: fetch, config
const { routingUrl } = require('../config')

async function getRouteDistance(start, end) {
  const url = new URL(routingUrl)
  url.searchParams.set('point', `${start.lat},${start.lng}`)
  url.searchParams.append('point', `${end.lat},${end.lng}`)
  url.searchParams.set('vehicle', 'car')
  url.searchParams.set('locale', 'ru')
  url.searchParams.set('points_encoded', 'false')
  const res = await fetch(url)
  const data = await res.json()
  if (!data.paths?.length) throw new Error('no route')
  const path = data.paths[0]
  return {
    distance: path.distance,
    coordinates: path.points.coordinates.map(([lng, lat]) => ({ lat, lng }))
  }
}

module.exports = { getRouteDistance }
