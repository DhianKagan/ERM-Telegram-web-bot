// Назначение: запросы к сервису ORSM
// Модули: fetch, config
const { routingUrl } = require('../config')
const base = routingUrl.replace(/\/route$/, '')

const allowed = ['table', 'nearest', 'match', 'trip']

function validateCoords(value) {
  const coordRx = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?(;-?\d+(\.\d+)?,-?\d+(\.\d+)?)*$/
  if (!coordRx.test(value)) throw new Error('Некорректные координаты')
  return value
}

async function call(endpoint, coords, params = {}) {
  if (!allowed.includes(endpoint)) throw new Error('Неизвестный эндпойнт')
  const safeCoords = validateCoords(coords)
  const url = new URL(`${base}/${endpoint}/v1/driving/${safeCoords}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.append(k, v)
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || data.code || 'Route error')
  return data
}

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

async function table(points, params = {}) {
  return call('table', points, params)
}

async function nearest(point, params = {}) {
  return call('nearest', point, params)
}

async function match(points, params = {}) {
  return call('match', points, params)
}

async function trip(points, params = {}) {
  return call('trip', points, params)
}
module.exports = { getRouteDistance, table, nearest, match, trip }
