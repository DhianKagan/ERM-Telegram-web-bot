// Централизованные функции работы с MongoDB для всего проекта
const { Task, Archive, Group, User, Department, Log } = require('./model')

async function createTask(data) {
  return Task.create(data)
}

async function getTask(id) {
  return Task.findById(id)
}

async function assignTask(userId, taskId) {
  return Task.findByIdAndUpdate(taskId, { assigned_user_id: userId })
}

async function assignGroup(groupId, taskId) {
  return Task.findByIdAndUpdate(taskId, { group_id: groupId })
}

async function listUserTasks(userId) {
  return Task.find({ assigned_user_id: userId })
}

async function listAllTasks() {
  return Task.find()
}

async function listMentionedTasks(userId) {
  return Task.find({
    $or: [
      { assigned_user_id: userId },
      { controller_user_id: userId },
      { controllers: userId },
      { assignees: userId },
      { created_by: userId },
      { 'comments.author_id': userId }
    ]
  })
}

async function updateTask(id, fields) {
  return Task.findByIdAndUpdate(id, fields, { new: true })
}

async function updateTaskStatus(id, status) {
  return updateTask(id, { status })
}

async function getTasks(filters = {}, page, limit) {
  if (filters.kanban) return Task.find({}).sort('-createdAt')
  const q = {}
  if (filters.project) q.group_id = filters.project
  if (filters.departmentId) q.departmentId = filters.departmentId
  if (filters.status) q.status = filters.status
  if (filters.assignees) q.assignees = { $in: filters.assignees }
  if (filters.from || filters.to) q.createdAt = {}
  if (filters.from) q.createdAt.$gte = filters.from
  if (filters.to) q.createdAt.$lte = filters.to
  let query = Task.find(q)
  if (page && limit) query = query.skip((page - 1) * limit).limit(limit)
  return query
}

async function listRoutes(filters = {}) {
  const q = {}
  if (filters.departmentId) q.departmentId = filters.departmentId
  // статус маршрута задаём как строку через $eq
  if (filters.status) q.status = { $eq: filters.status }
  if (filters.from || filters.to) q.createdAt = {}
  if (filters.from) q.createdAt.$gte = filters.from
  if (filters.to) q.createdAt.$lte = filters.to
  return Task.find(q).select('startCoordinates finishCoordinates route_distance_km departmentId status createdAt')
}

async function searchTasks(text) {
  return Task.find({
    $or: [
      { title: { $regex: text, $options: 'i' } },
      { task_description: { $regex: text, $options: 'i' } }
    ]
  }).limit(10)
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

async function addAttachment(taskId, attachment) {
  return Task.findByIdAndUpdate(taskId, { $push: { attachments: attachment } }, { new: true })
}

async function deleteTask(id) {
  const doc = await Task.findByIdAndDelete(id)
  if (!doc) return null
  const data = doc.toObject()
  data.request_id = `${data.request_id}-DEL`
  await Archive.create(data)
  return doc
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

async function createDepartment(name) {
  return Department.create({ name })
}

async function listDepartments() {
  return Department.find()
}

async function updateDepartment(id, name) {

  if (typeof name !== 'string') {
    throw new Error('Invalid input: name must be a string')
  }
  return Department.findByIdAndUpdate(id, { $set: { name: String(name) } }, { new: true })

}

async function deleteDepartment(id) {
  return Department.findByIdAndDelete(id)
}

async function createUser(id, username, role = 'user', extra = {}) {
  const email = `${id}@telegram.local`
  return User.create({ telegram_id: id, username, email, role, ...extra })
}

async function getUser(id) {
  return User.findOne({ telegram_id: { $eq: id } })
}


async function listUsers() {
  return User.find()
}

async function updateUser(id, data) {
  return User.findOneAndUpdate({ telegram_id: id }, data, { new: true })
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
  assignGroup,
  listUserTasks,
  listAllTasks,
  listMentionedTasks,
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
  createDepartment,
  listDepartments,
  createUser,
  getUser,
  listUsers,
  updateUser,
  writeLog,
  listLogs,
  searchTasks,
  addAttachment,
  updateDepartment,
  deleteDepartment,
  listRoutes
}
