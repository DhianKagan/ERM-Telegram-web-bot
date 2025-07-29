// Проверяет право пользователя изменять задачу
const { hasAccess, ACCESS_ADMIN, ACCESS_USER } = require('../utils/accessMask');
const service = require('../services/tasks');
const { writeLog } = require('../services/service');

module.exports = async function checkTaskAccess(req, res, next) {
  const task = await service.getById(req.params.id);
  if (!task) return res.sendStatus(404);
  const mask = req.user?.access || ACCESS_USER;
  const id = Number(req.user.id);
  if (
    hasAccess(mask, ACCESS_ADMIN) ||
    task.created_by === id ||
    task.assigned_user_id === id ||
    task.controller_user_id === id ||
    (Array.isArray(task.assignees) && task.assignees.includes(id)) ||
    (Array.isArray(task.controllers) && task.controllers.includes(id))
  ) {
    req.task = task;
    return next();
  }
  await writeLog(
    `Нет доступа ${req.method} ${req.originalUrl} user:${id}/${req.user.username} ip:${req.ip}`,
  ).catch(() => {});
  return res.status(403).json({ message: 'Forbidden' });
};
