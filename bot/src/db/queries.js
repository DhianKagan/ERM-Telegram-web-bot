// Централизованные функции работы с MongoDB для всего проекта
const { Task, Group, User, Role, Log } = require('./model')

async function createTask(data) {
  return Task.create(data)
}

async function getTask(id) {
  return Task.findById(id)
}

async function assignTask(userId, taskId) {
  return Task.findByIdAndUpdate(taskId, { assigned_user_id: userId })
}

async function listUserTasks(userId) {
  return Task.find({ assigned_user_id: userId })
}

async function listAllTasks() {
  return Task.find()
}

async function updateTask(id, fields) {
  return Task.findByIdAndUpdate(id, fields, { new: true })
}

async function updateTaskStatus(id, status) {
  return updateTask(id, { status })
}

async function getTasks(filters = {}) {
  if (filters.kanban) return Task.find({}).sort('-createdAt')
  const q = {}
  if (filters.project) q.group_id = filters.project
  if (filters.status) q.status = filters.status
  if (filters.assignees) q.assignees = { $in: filters.assignees }
  if (filters.from || filters.to) q.createdAt = {}
  if (filters.from) q.createdAt.$gte = filters.from
  if (filters.to) q.createdAt.$lte = filters.to
  return Task.find(q)
}

async function addTime(id, minutes) {
  const task = await Task.findById(id)
  if (!task) return null
  task.time_spent += minutes
  await task.save()
  return task
}

async function bulkUpdate(ids, data) {
  await Task.updateMany({ _id: { $in: ids } }, data)
}

async function deleteTask(id) {
  return Task.findByIdAndDelete(id)
}

async function summary(filters = {}) {
  const match = {}
  if (filters.from) match.createdAt = { $gte: new Date(filters.from) }
  if (filters.to) {
    match.createdAt = match.createdAt || {}
    match.createdAt.$lte = new Date(filters.to)
  }
  const res = await Task.aggregate([
    Object.keys(match).length ? { $match: match } : undefined,
    { $group: { _id: null, count: { $sum: 1 }, time: { $sum: '$time_spent' } } }
  ].filter(Boolean))
  const { count = 0, time = 0 } = res[0] || {}
  return { count, time }
}

async function createGroup(name) {
  return Group.create({ name })
}

async function listGroups() {
  return Group.find()
}

async function createUser(id, username) {
  // Уникальный email нужен из-за существующего индекса в базе данных.
  const email = `${id}@telegram.local`
  return User.create({ telegram_id: id, username, email })
}

async function getUser(id) {
  return User.findOne({ telegram_id: id })
}

async function listUsers() {
  return User.find()
}

async function createRole(name) {
  return Role.create({ name })
}

async function listRoles() {
  return Role.find()
}

async function writeLog(message, level = 'info') {
  return Log.create({ message, level })
}

async function listLogs() {
  return Log.find().sort({ createdAt: -1 }).limit(100)
}

module.exports = {
  createTask,
  assignTask,
  listUserTasks,
  listAllTasks,
  updateTask,
  updateTaskStatus,
  getTask,
  getTasks,
  addTime,
  bulkUpdate,
  deleteTask,
  summary,
  createGroup,
  listGroups,
  createUser,
  getUser,
  listUsers,
  createRole,
  listRoles,
  writeLog,
  listLogs
}
