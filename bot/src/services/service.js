// Сервис для управления задачами в MongoDB
const Task = require('../db/model')

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

module.exports = { createTask, assignTask, listUserTasks, updateTaskStatus, listAllTasks }
