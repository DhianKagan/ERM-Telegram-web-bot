// Сервисные функции задач используют общие запросы к MongoDB
const q = require('../db/queries')

const create = data => {
  if (data.due_date && !data.remind_at) data.remind_at = data.due_date
  return q.createTask(data)
}
const get = (filters, page, limit) => q.getTasks(filters, page, limit)
const getById = id => q.getTask(id)
const update = (id, data) => q.updateTask(id, data)
const addTime = (id, minutes) => q.addTime(id, minutes)
const bulk = (ids, data) => q.bulkUpdate(ids, data)
const summary = filters => q.summary(filters)
const remove = id => q.deleteTask(id)
const mentioned = userId => q.listMentionedTasks(userId)

module.exports = { create, get, getById, update, addTime, bulk, remove, summary, mentioned }
