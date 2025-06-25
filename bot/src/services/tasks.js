// Сервисные функции задач используют общие запросы к MongoDB
const q = require('../db/queries')

const create = data => q.createTask(data)
const get = filters => q.getTasks(filters)
const getById = id => q.getTask(id)
const update = (id, data) => q.updateTask(id, data)
const addTime = (id, minutes) => q.addTime(id, minutes)
const bulk = (ids, data) => q.bulkUpdate(ids, data)
const summary = () => q.summary()
const remove = id => q.deleteTask(id)

module.exports = { create, get, getById, update, addTime, bulk, remove, summary }
