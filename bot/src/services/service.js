// Сервис для управления сущностями MongoDB через единый набор функций
const q = require('../db/queries')

module.exports = {
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
  deleteTask: q.deleteTask
}
