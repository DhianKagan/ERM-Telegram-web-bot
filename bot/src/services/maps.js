// Получение полной ссылки Google Maps и извлечение координат
// Модули: node.js fetch

async function expandMapsUrl(shortUrl) {
  const res = await fetch(shortUrl, { redirect: 'follow' })
  return res.url
}

function extractCoords(url) {
  let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (!m) {
    m = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
  }
  if (m) {
    return { lat: Number(m[1]), lng: Number(m[2]) }
  }
  return null
}

// Формирует ссылку маршрута Google Maps из координат
// travelmode по умолчанию driving
function generateRouteLink(start, end, mode = 'driving') {
  if (!start || !end) return ''
  return `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lng}&destination=${end.lat},${end.lng}&travelmode=${mode}`
}

module.exports = { expandMapsUrl, extractCoords, generateRouteLink }
