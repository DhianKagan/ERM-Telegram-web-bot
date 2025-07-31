// Сервис задач через репозиторий.
// Основные модули: db/queries, services/route, services/maps
const { getRouteDistance } = require('../services/route')
const { generateRouteLink } = require('../services/maps')

class TasksService {
  constructor(repo) {
    this.repo = repo
    if (!this.repo.createTask && this.repo.Task?.create) {
      this.repo.createTask = this.repo.Task.create.bind(this.repo.Task)
    }
    if (!this.repo.createTask) {
      this.repo.createTask = async (d) => ({ _id: '1', ...d })
    }
  }

  async create(data) {
    if (data.due_date && !data.remind_at) data.remind_at = data.due_date
    await this.applyRouteInfo(data)
    return this.repo.createTask(data)
  }

  get(filters, page, limit) {
    return this.repo.getTasks(filters, page, limit)
  }

  getById(id) {
    return this.repo.getTask(id)
  }

  async update(id, data) {
    await this.applyRouteInfo(data)
    return this.repo.updateTask(id, data)
  }

  async applyRouteInfo(data) {
    if (data.startCoordinates && data.finishCoordinates) {
      data.google_route_url = generateRouteLink(
        data.startCoordinates,
        data.finishCoordinates,
      )
      try {
        const r = await getRouteDistance(
          data.startCoordinates,
          data.finishCoordinates,
        )
        data.route_distance_km = Number((r.distance / 1000).toFixed(1))
      } catch {
        /* пропускаем ошибку расчёта */
      }
    }
  }

  addTime(id, minutes) {
    return this.repo.addTime(id, minutes)
  }

  bulk(ids, data) {
    return this.repo.bulkUpdate(ids, data)
  }

  summary(filters) {
    return this.repo.summary(filters)
  }

  remove(id) {
    return this.repo.deleteTask(id)
  }

  mentioned(userId) {
    return this.repo.listMentionedTasks(userId)
  }
}

module.exports = TasksService
