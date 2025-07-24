// Сервис для управления сущностями MongoDB через единый набор функций
const q = require('../db/queries');
const logEngine = require('./wgLogEngine');

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
  writeLog: logEngine.writeLog,
  listLogs: (params) => logEngine.listLogs(params),
  searchTasks: q.searchTasks,
  listMentionedTasks: q.listMentionedTasks,
  deleteTask: q.deleteTask,
};
