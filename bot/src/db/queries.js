// Централизованные функции работы с MongoDB для всего проекта
const { Task, Group, User, Role, Department, Log } = require('./model')
const UniversalTask = require('./universalTaskModel')
const { DefaultValue, Transport } = require('./dictionaryModel')

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
  return Task.findByIdAndDelete(id)
}

async function createUniversalTask(data) {
  return UniversalTask.create(data)
}

async function getUniversalTask(id) {
  return UniversalTask.findById(id)
}

async function listUniversalTasks() {
  return UniversalTask.find()
}

async function updateUniversalTask(id, fields) {
  return UniversalTask.findByIdAndUpdate(id, fields, { new: true })
}

async function deleteUniversalTask(id) {
  return UniversalTask.findByIdAndDelete(id)
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

async function createUser(id, username, roleId, extra = {}) {
  const email = `${id}@telegram.local`
  if (!roleId) {
    const role = await Role.findOne({ name: 'user' })
    roleId = role ? role._id : undefined
  }
  return User.create({ telegram_id: id, username, email, roleId, ...extra })
}

async function getUser(id) {
  return User.findOne({ telegram_id: id }).populate('roleId').populate('departmentId')
}


async function listUsers() {
  return User.find().populate('roleId').populate('departmentId')
}

async function updateUser(id, data) {
  return User.findOneAndUpdate({ telegram_id: id }, data, { new: true })
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

async function getDefaultValues(name) {
  const doc = await DefaultValue.findOne({ name })
  return doc ? doc.values : []
}

async function setDefaultValues(name, values) {
  return DefaultValue.findOneAndUpdate(
    { name },
    { values },
    { upsert: true, new: true }
  )
}

async function listTransports() {
  return Transport.find()
}

async function createTransport(data) {
  return Transport.create(data)
}

async function updateTransport(id, data) {
  return Transport.findByIdAndUpdate(id, data, { new: true })
}

async function deleteTransport(id) {
  return Transport.findByIdAndDelete(id)
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
  createRole,
  listRoles,
  writeLog,
  listLogs,
  searchTasks,
  addAttachment,
  createUniversalTask,
  getUniversalTask,
  listUniversalTasks,
  updateUniversalTask,
  deleteUniversalTask,
  getDefaultValues,
  setDefaultValues,
  listTransports,
  createTransport,
  updateTransport,
  deleteTransport
}
