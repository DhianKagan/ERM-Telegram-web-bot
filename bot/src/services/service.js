// Сервис для управления задачами в MongoDB
const { Task, Group, User } = require('../db/model')

async function createTask(description) {
  return Task.create({ task_description: description })
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

async function updateTaskStatus(taskId, status) {
  await Task.findByIdAndUpdate(taskId, { status })
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

module.exports = {
  createTask,
  assignTask,
  listUserTasks,
  updateTaskStatus,
  listAllTasks,
  createGroup,
  listGroups,
  createUser,
  listUsers
}
