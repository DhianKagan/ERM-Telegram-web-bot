// Сервис для управления сущностями MongoDB через единый набор функций
const q = require('../db/queries')

function createTask(title, dueDate, priority = 'В течение дня', groupId, userId, startDate) {
  return q.createTask({
    title,
    task_description: title,
    start_date: startDate,
    due_date: dueDate,
    remind_at: dueDate,
    priority,
    group_id: groupId,
    assigned_user_id: userId,
    created_by: userId
  })
}

module.exports = {
  createTask,
  assignTask: q.assignTask,
  assignGroup: q.assignGroup,
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
  listLogs: q.listLogs,
  createDepartment: q.createDepartment,
  listDepartments: q.listDepartments,
  updateDepartment: q.updateDepartment,
  deleteDepartment: q.deleteDepartment,
  searchTasks: q.searchTasks,
  listMentionedTasks: q.listMentionedTasks,
  addAttachment: q.addAttachment,
  deleteTask: q.deleteTask
}
