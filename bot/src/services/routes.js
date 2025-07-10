// Сервис получения маршрутов из MongoDB
const q = require('../db/queries')

module.exports = {
  list: filters => q.listRoutes(filters)
}
