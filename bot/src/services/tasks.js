// Сервисные функции задач: CRUD, отчёты и таймтрекер
const { Task } = require('../db/model')

async function create(data) {
  return Task.create({ ...data })
}

async function get(filters = {}) {
  const q = {}
  if (filters.project) q.group_id = filters.project
  if (filters.status) q.status = filters.status
  if (filters.assignees) q.assignees = { $in: filters.assignees }
  if (filters.from || filters.to) q.createdAt = {}
  if (filters.from) q.createdAt.$gte = filters.from
  if (filters.to) q.createdAt.$lte = filters.to
  return Task.find(q)
}

async function update(id, data) {
  return Task.findByIdAndUpdate(id, data, { new: true })
}

async function addTime(id, minutes) {
  const task = await Task.findById(id)
  if (!task) return null
  task.time_spent += minutes
  await task.save()
  return task
}

async function bulk(ids, data) {
  await Task.updateMany({ _id: { $in: ids } }, data)
}

async function summary() {
  const res = await Task.aggregate([
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        time: { $sum: '$time_spent' }
      }
    }
  ])
  const { count = 0, time = 0 } = res[0] || {}
  return { count, time }
}

module.exports = { create, get, update, addTime, bulk, summary }
