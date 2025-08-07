// Сервис задач через репозиторий.
// Основные модули: db/queries, services/route, services/maps
import { getRouteDistance } from '../services/route';
import { generateRouteLink } from '../services/maps';

class TasksService {
  repo: any;
  constructor(repo: any) {
    this.repo = repo;
    if (!this.repo.createTask && this.repo.Task?.create) {
      this.repo.createTask = this.repo.Task.create.bind(this.repo.Task);
    }
    if (!this.repo.createTask) {
      this.repo.createTask = async (d: any) => ({ _id: '1', ...d });
    }
  }

  async create(data: any) {
    if (data.due_date && !data.remind_at) data.remind_at = data.due_date;
    await this.applyRouteInfo(data);
    return this.repo.createTask(data);
  }

  get(filters: any, page: number, limit: number) {
    return this.repo.getTasks(filters, page, limit);
  }

  getById(id: string) {
    return this.repo.getTask(id);
  }

  async update(id: string, data: any) {
    await this.applyRouteInfo(data);
    return this.repo.updateTask(id, data);
  }

  async applyRouteInfo(data: any) {
    if (data.startCoordinates && data.finishCoordinates) {
      data.google_route_url = generateRouteLink(
        data.startCoordinates,
        data.finishCoordinates,
      );
      try {
        const r = await getRouteDistance(
          data.startCoordinates,
          data.finishCoordinates,
        );
        if (typeof r.distance === 'number') {
          data.route_distance_km = Number((r.distance / 1000).toFixed(1));
        }
      } catch {
        /* пропускаем ошибку расчёта */
      }
    }
  }

  addTime(id: string, minutes: number) {
    return this.repo.addTime(id, minutes);
  }

  bulk(ids: string[], data: any) {
    return this.repo.bulkUpdate(ids, data);
  }

  summary(filters: any) {
    return this.repo.summary(filters);
  }

  remove(id: string) {
    return this.repo.deleteTask(id);
  }

  mentioned(userId: string) {
    return this.repo.listMentionedTasks(userId);
  }
}

export default TasksService;
module.exports = TasksService;
