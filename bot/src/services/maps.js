// Получение полной ссылки Google Maps
// Модули: node.js fetch, shared/mapUtils
const {
  extractCoords,
  generateRouteLink,
  generateMultiRouteLink,
} = require('../../shared/mapUtils')

async function expandMapsUrl(shortUrl) {
  const res = await fetch(shortUrl, { redirect: 'follow' })
  return res.url
}

module.exports = {
  expandMapsUrl,
  extractCoords,
  generateRouteLink,
  generateMultiRouteLink
}
