// Сервисные функции задач используют общие запросы к MongoDB
const q = require('../db/queries')

const create = data => q.createTask(data)
const get = filters => q.getTasks(filters)
const update = (id, data) => q.updateTask(id, data)
const addTime = (id, minutes) => q.addTime(id, minutes)
const bulk = (ids, data) => q.bulkUpdate(ids, data)
const summary = () => q.summary()

module.exports = { create, get, update, addTime, bulk, summary }
