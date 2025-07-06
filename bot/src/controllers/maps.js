// Назначение: развёртывание коротких ссылок Google Maps
// Модули: express
const { expandMapsUrl, extractCoords } = require('../services/maps')

exports.expand = async (req, res) => {
  try {
    const full = await expandMapsUrl(req.body.url)
    res.json({ url: full, coords: extractCoords(full) })
  } catch {
    res.status(400).json({ error: 'invalid url' })
  }
}
