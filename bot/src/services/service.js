// Сервис для управления задачами в MongoDB
const { Task, Group, User, Log } = require('../db/model')

async function createTask(description, dueDate, priority = 'low') {
  return Task.create({
    task_description: description,
    due_date: dueDate,
    priority
  })
}

async function assignTask(userId, taskId) {
  await Task.findByIdAndUpdate(taskId, { assigned_user_id: userId })
}

async function listUserTasks(userId) {
  return Task.find({ assigned_user_id: userId })
}

async function listAllTasks () {
  return Task.find()
}

async function updateTask(id, fields) {
  await Task.findByIdAndUpdate(id, fields)
}

async function updateTaskStatus(taskId, status) {
  await updateTask(taskId, { status })
}

async function createGroup(name) {
  return Group.create({ name })
}

async function listGroups() {
  return Group.find()
}

async function createUser(id, username) {
  return User.create({ telegram_id: id, username })
}

async function listUsers() {
  return User.find()
}

async function createLog(message) {
  return Log.create({ message })
}

async function listLogs() {
  return Log.find().sort({ createdAt: -1 }).limit(100)
}

module.exports = {
  createTask,
  assignTask,
  listUserTasks,
  updateTask,
  updateTaskStatus,
  listAllTasks,
  createGroup,
  listGroups,
  createUser,
  listUsers,
  createLog,
  listLogs
}
