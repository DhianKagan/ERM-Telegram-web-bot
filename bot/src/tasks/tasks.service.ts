// Сервис задач через репозиторий.
// Основные модули: db/queries, services/route, services/maps
import { getRouteDistance } from '../services/route';
import { generateRouteLink } from '../services/maps';
import type { TaskDocument } from '../db/model';
import type { TaskFilters, SummaryFilters } from '../db/queries';

interface TasksRepository {
  createTask(data: Partial<TaskDocument>): Promise<TaskDocument>;
  getTasks(
    filters: TaskFilters,
    page?: number,
    limit?: number,
  ): Promise<TaskDocument[]>;
  getTask(id: string): Promise<TaskDocument | null>;
  updateTask(
    id: string,
    data: Partial<TaskDocument>,
  ): Promise<TaskDocument | null>;
  addTime(id: string, minutes: number): Promise<TaskDocument | null>;
  bulkUpdate(ids: string[], data: Partial<TaskDocument>): Promise<void>;
  summary(filters: SummaryFilters): Promise<{ count: number; time: number }>;
  deleteTask(id: string): Promise<TaskDocument | null>;
  listMentionedTasks(userId: string | number): Promise<TaskDocument[]>;
}

interface RepositoryWithModel extends TasksRepository {
  Task?: { create: (data: Partial<TaskDocument>) => Promise<TaskDocument> };
}

class TasksService {
  repo: TasksRepository;
  constructor(repo: RepositoryWithModel) {
    this.repo = repo;
    if (!this.repo.createTask && repo.Task?.create) {
      this.repo.createTask = repo.Task.create.bind(repo.Task);
    }
    if (!this.repo.createTask) {
      this.repo.createTask = async (d: Partial<TaskDocument>) =>
        ({
          _id: '1',
          ...d,
        }) as TaskDocument;
    }
  }

  async create(data: Partial<TaskDocument>) {
    if (data.due_date && !data.remind_at) data.remind_at = data.due_date;
    await this.applyRouteInfo(data);
    return this.repo.createTask(data);
  }

  get(filters: TaskFilters, page?: number, limit?: number) {
    return this.repo.getTasks(filters, page, limit);
  }

  getById(id: string) {
    return this.repo.getTask(id);
  }

  async update(id: string, data: Partial<TaskDocument>) {
    await this.applyRouteInfo(data);
    return this.repo.updateTask(id, data);
  }

  async applyRouteInfo(data: Partial<TaskDocument>) {
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

  bulk(ids: string[], data: Partial<TaskDocument>) {
    return this.repo.bulkUpdate(ids, data);
  }

  summary(filters: SummaryFilters) {
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
