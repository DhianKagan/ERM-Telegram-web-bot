// Сервис для управления сущностями MongoDB через единый набор функций
const q = require('../db/queries')

function createTask(title, dueDate, priority = 'В течение дня', _groupId, userId, startDate) {
  return q.createTask({
    title,
    task_description: title,
    start_date: startDate,
    due_date: dueDate,
    remind_at: dueDate,
    priority,
    assigned_user_id: userId,
    created_by: userId
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
  createUser: q.createUser,
  listUsers: q.listUsers,
  updateUser: q.updateUser,
  listRoles: q.listRoles,
  getRole: q.getRole,
  updateRole: q.updateRole,
  getUser: q.getUser,
  writeLog: q.writeLog,
  listLogs: q.listLogs,
  searchTasks: q.searchTasks,
  listMentionedTasks: q.listMentionedTasks,
  addAttachment: q.addAttachment,
  deleteTask: q.deleteTask
}
