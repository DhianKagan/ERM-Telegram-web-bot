// Централизованные функции работы с MongoDB для всего проекта
const { Task, Archive, User, Log, Role } = require('./model');
const config = require('../config');

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function createTask(data) {
  return Task.create(data);
}

async function getTask(id) {
  return Task.findById(id);
}

async function listMentionedTasks(userId) {
  return Task.find({
    $or: [
      { assigned_user_id: userId },
      { controller_user_id: userId },
      { controllers: userId },
      { assignees: userId },
      { created_by: userId },
      { 'comments.author_id': userId },
    ],
  });
}

async function updateTask(id, fields) {
  return Task.findByIdAndUpdate(id, fields, { new: true });
}

async function updateTaskStatus(id, status) {
  return updateTask(id, { status });
}

async function getTasks(filters = {}, page, limit) {
  if (filters.kanban) {
    let qKanban = Task.find({}).sort('-createdAt');
    if (typeof qKanban.lean === 'function') qKanban = qKanban.lean();
    return qKanban;
  }
  const q = {};
  if (filters.status) q.status = { $eq: filters.status }; // Use $eq to ensure literal value
  if (filters.assignees && Array.isArray(filters.assignees)) {
    q.assignees = {
      $in: filters.assignees.map((assignee) => String(assignee)),
    }; // Sanitize assignees
  }
  if (filters.from || filters.to) q.createdAt = {};
  if (filters.from) q.createdAt.$gte = new Date(filters.from); // Ensure valid date
  if (filters.to) q.createdAt.$lte = new Date(filters.to); // Ensure valid date
  let query = Task.find(q);
  if (typeof query.lean === 'function') query = query.lean();
  if (typeof query.skip === 'function') {
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    query = query.skip((p - 1) * l).limit(l);
    return query;
  }
  return query;
}

async function listRoutes(filters = {}) {
  const q = {};
  // статус маршрута задаём как строку через $eq
  if (filters.status) q.status = { $eq: filters.status };
  if (filters.from || filters.to) q.createdAt = {};
  if (filters.from) q.createdAt.$gte = filters.from;
  if (filters.to) q.createdAt.$lte = filters.to;
  return Task.find(q).select(
    'startCoordinates finishCoordinates route_distance_km status createdAt',
  );
}

async function searchTasks(text) {
  const safe = escapeRegex(text);
  return Task.find({
    $or: [
      { title: { $regex: safe, $options: 'i' } },
      { task_description: { $regex: safe, $options: 'i' } },
    ],
  }).limit(10);
}

async function addTime(id, minutes) {
  const task = await Task.findById(id);
  if (!task) return null;
  task.time_spent += minutes;
  await task.save();
  return task;
}

async function bulkUpdate(ids, data) {
  await Task.updateMany({ _id: { $in: ids } }, data);
}

async function deleteTask(id) {
  const doc = await Task.findByIdAndDelete(id);
  if (!doc) return null;
  const data = doc.toObject();
  data.request_id = `${data.request_id}-DEL`;
  await Archive.create(data);
  return doc;
}

async function summary(filters = {}) {
  const match = {};
  if (filters.from) match.createdAt = { $gte: new Date(filters.from) };
  if (filters.to) {
    match.createdAt = match.createdAt || {};
    match.createdAt.$lte = new Date(filters.to);
  }
  const res = await Task.aggregate(
    [
      Object.keys(match).length ? { $match: match } : undefined,
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          time: { $sum: '$time_spent' },
        },
      },
    ].filter(Boolean),
  );
  const { count = 0, time = 0 } = res[0] || {};
  return { count, time };
}

async function createUser(id, username, roleId, extra = {}) {
  const telegramId = Number(id);
  if (Number.isNaN(telegramId)) throw new Error('Invalid telegram_id');
  const email = `${telegramId}@telegram.local`;
  let role = 'user';
  let rId = roleId || config.userRoleId;
  if (rId) {
    const { Types } = require('mongoose');
    if (!Types.ObjectId.isValid(rId)) {
      throw new Error('Invalid roleId');
    }
    const dbRole = await Role.findById(rId);
    if (dbRole) {
      role = dbRole.name;
      rId = dbRole._id;
    }
  }
  return User.create({
    telegram_id: telegramId,
    username,
    email,
    name: username,
    role,
    roleId: rId,
    access: extra.access || 1,
    ...extra,
  });
}

async function getUser(id) {
  const telegramId = Number(id);
  if (Number.isNaN(telegramId)) return null;
  return User.findOne({ telegram_id: telegramId });
}

async function listUsers() {
  return User.find();
}

async function getUsersMap(ids = []) {
  const numeric = ids.map((id) => Number(id)).filter((id) => !Number.isNaN(id));
  const list = await User.find({ telegram_id: { $in: numeric } });
  const map = {};
  list.forEach((u) => {
    map[u.telegram_id] = u;
  });
  return map;
}

async function updateUser(id, data) {
  const telegramId = Number(id);
  if (Number.isNaN(telegramId)) return null;
  return User.findOneAndUpdate({ telegram_id: telegramId }, data, {
    new: true,
  });
}

async function listRoles() {
  return Role.find();
}

async function getRole(id) {
  return Role.findById(id);
}

async function updateRole(id, permissions) {
  const sanitizedPermissions = Array.isArray(permissions)
    ? permissions.filter(
        (item) => typeof item === 'string' || typeof item === 'number',
      )
    : [];
  return Role.findByIdAndUpdate(
    id,
    { permissions: sanitizedPermissions },
    { new: true },
  );
}

async function writeLog(message, level = 'info') {
  return Log.create({ message, level });
}

async function listLogs() {
  return Log.find().sort({ createdAt: -1 }).limit(100);
}

module.exports = {
  createTask,
  listMentionedTasks,
  updateTask,
  updateTaskStatus,
  getTask,
  getTasks,
  addTime,
  bulkUpdate,
  deleteTask,
  summary,
  createUser,
  getUser,
  listUsers,
  getUsersMap,
  updateUser,
  listRoles,
  getRole,
  updateRole,
  writeLog,
  listLogs,
  searchTasks,
  listRoutes,
};
