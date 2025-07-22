// Сервисные функции задач используют общие запросы к MongoDB
const q = require('../db/queries')
const { getRouteDistance } = require('./route')
const { generateRouteLink } = require('./maps')
const cache = require('./cache')

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
const CACHE_TTL = 30
const getById = async id => {
  const key = `task:${id}`
  const cached = await cache.get(key)
  if (cached) return JSON.parse(cached)
  const task = await q.getTask(id)
  if (task) await cache.setex(key, CACHE_TTL, JSON.stringify(task))
  return task
}
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
  await cache.del(`task:${id}`)
  return q.updateTask(id, data)
}
const addTime = (id, minutes) => q.addTime(id, minutes)
const bulk = (ids, data) => q.bulkUpdate(ids, data)
const summary = filters => q.summary(filters)
const remove = async id => {
  await cache.del(`task:${id}`)
  return q.deleteTask(id)
}
const mentioned = userId => q.listMentionedTasks(userId)

module.exports = { create, get, getById, update, addTime, bulk, remove, summary, mentioned }
