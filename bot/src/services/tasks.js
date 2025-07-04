// Сервисные функции задач используют общие запросы к MongoDB
const q = require('../db/queries')

const create = data => {
  if (data.due_date && !data.remind_at) data.remind_at = data.due_date
  if (!data.transport_type) data.transport_type = 'Авто'
  if (!data.payment_method) data.payment_method = 'Карта'
  if (!data.priority) data.priority = 'В течении дня'
  if (!data.status) data.status = 'new'
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
