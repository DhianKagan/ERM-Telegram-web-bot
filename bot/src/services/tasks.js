// Сервисные функции задач используют общие запросы к MongoDB
const q = require('../db/queries')
const { getRouteDistance } = require('./route')
const { generateRouteLink } = require('./maps')

const create = async data => {
  if (data.due_date && !data.remind_at) data.remind_at = data.due_date
  if (data.startCoordinates && data.finishCoordinates) {
    data.google_route_url = generateRouteLink(data.startCoordinates, data.finishCoordinates)
    try {
      const r = await getRouteDistance(data.startCoordinates, data.finishCoordinates)
      data.route_distance_km = Number((r.distance / 1000).toFixed(1))
    } catch (e) {
      void e // пропускаем ошибку расчёта
    }
  }
  return q.createTask(data)
}
const get = (filters, page, limit) => q.getTasks(filters, page, limit)
const getById = id => q.getTask(id)
const update = async (id, data) => {
  if (data.startCoordinates && data.finishCoordinates) {
    data.google_route_url = generateRouteLink(data.startCoordinates, data.finishCoordinates)
    try {
      const r = await getRouteDistance(data.startCoordinates, data.finishCoordinates)
      data.route_distance_km = Number((r.distance / 1000).toFixed(1))
    } catch (e) {
      void e // пропускаем ошибку расчёта
    }
  }
  return q.updateTask(id, data)
}
const addTime = (id, minutes) => q.addTime(id, minutes)
const bulk = (ids, data) => q.bulkUpdate(ids, data)
const summary = filters => q.summary(filters)
const remove = id => q.deleteTask(id)
const mentioned = userId => q.listMentionedTasks(userId)

module.exports = { create, get, getById, update, addTime, bulk, remove, summary, mentioned }
