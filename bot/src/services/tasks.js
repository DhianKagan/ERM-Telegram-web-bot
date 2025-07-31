// Сервисные функции задач используют общие запросы к MongoDB
const q = require('../db/queries');
const { getRouteDistance } = require('./route');
const { generateRouteLink } = require('./maps');

function applyRouteInfo(data) {
  if (data.startCoordinates && data.finishCoordinates) {
    data.google_route_url = generateRouteLink(
      data.startCoordinates,
      data.finishCoordinates,
    );
    return getRouteDistance(data.startCoordinates, data.finishCoordinates)
      .then((r) => {
        data.route_distance_km = Number((r.distance / 1000).toFixed(1));
      })
      .catch(() => {});
  }
  return Promise.resolve();
}

const create = async (data) => {
  if (data.due_date && !data.remind_at) data.remind_at = data.due_date;
  await applyRouteInfo(data);
  return q.createTask(data);
};
const get = (filters, page, limit) => q.getTasks(filters, page, limit);
const getById = (id) => q.getTask(id);
const update = async (id, data) => {
  await applyRouteInfo(data);
  return q.updateTask(id, data);
};
const addTime = (id, minutes) => q.addTime(id, minutes);
const bulk = (ids, data) => q.bulkUpdate(ids, data);
const summary = (filters) => q.summary(filters);
const remove = (id) => q.deleteTask(id);
const mentioned = (userId) => q.listMentionedTasks(userId);

module.exports = {
  create,
  get,
  getById,
  update,
  addTime,
  bulk,
  remove,
  summary,
  mentioned,
};
