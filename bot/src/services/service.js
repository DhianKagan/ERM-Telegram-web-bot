// Сервис для управления сущностями MongoDB через единый набор функций
const q = require('../db/queries')

function createTask(title, dueDate, priority = 'В течении дня', groupId, userId) {
  return q.createTask({
    title,
    task_description: title,
    due_date: dueDate,
    priority,
    group_id: groupId,
    assigned_user_id: userId
  })
}

module.exports = {
  createTask,
  assignTask: q.assignTask,
  listUserTasks: q.listUserTasks,
  listAllTasks: q.listAllTasks,
  getTask: q.getTask,
  updateTask: q.updateTask,
  updateTaskStatus: q.updateTaskStatus,
  createGroup: q.createGroup,
  listGroups: q.listGroups,
  createUser: q.createUser,
  listUsers: q.listUsers,
  updateUser: q.updateUser,
  getUser: q.getUser,
  createRole: q.createRole,
  listRoles: q.listRoles,
  writeLog: q.writeLog,
  listLogs: q.listLogs
}
