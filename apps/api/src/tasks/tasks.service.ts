// Сервис задач через репозиторий.
// Основные модули: db/queries, services/route, shared
import { getRouteDistance, clearRouteCache } from '../services/route';
import { generateRouteLink } from 'shared';
import { applyIntakeRules } from '../intake/rules';
import type { TaskDocument } from '../db/model';
import type { TaskFilters, SummaryFilters } from '../db/queries';
import { writeLog as writeAttachmentLog } from '../services/wgLogEngine';
import { extractAttachmentIds } from '../utils/attachments';

interface TasksRepository {
  createTask(
    data: Partial<TaskDocument>,
    userId?: number,
  ): Promise<TaskDocument>;
  getTasks(
    filters: TaskFilters,
    page?: number,
    limit?: number,
  ): Promise<{ tasks: TaskDocument[]; total: number }>;
  getTask(id: string): Promise<TaskDocument | null>;
  updateTask(
    id: string,
    data: Partial<TaskDocument>,
    userId: number,
  ): Promise<TaskDocument | null>;
  addTime(id: string, minutes: number): Promise<TaskDocument | null>;
  bulkUpdate(ids: string[], data: Partial<TaskDocument>): Promise<void>;
  summary(filters: SummaryFilters): Promise<{ count: number; time: number }>;
  deleteTask(id: string): Promise<TaskDocument | null>;
  listMentionedTasks(userId: string | number): Promise<TaskDocument[]>;
}

interface RepositoryWithModel extends TasksRepository {
  Task?: {
    create: (
      data: Partial<TaskDocument>,
      userId?: number,
    ) => Promise<TaskDocument>;
  };
}

const toNumeric = (value: unknown): number | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const normalized = value
      .trim()
      .replace(/\s+/g, '')
      .replace(/,/g, '.');
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const roundValue = (value: number, digits = 3) =>
  Number(Number.isFinite(value) ? value.toFixed(digits) : Number.NaN);

const setMetric = (
  target: Record<string, unknown>,
  key: keyof TaskDocument,
  value: number | undefined,
) => {
  if (value === undefined || Number.isNaN(value)) {
    delete target[key as string];
    return;
  }
  target[key as string] = value;
};

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

  private async logAttachmentSync(
    action: 'create' | 'update',
    task: TaskDocument | null,
    shouldLog: boolean,
  ) {
    if (!task || !shouldLog) return;
    const ids = extractAttachmentIds(task.attachments || []);
    const message =
      action === 'create'
        ? `Вложения привязаны к задаче ${String(task._id)}`
        : `Вложения обновлены у задачи ${String(task._id)}`;
    try {
      await writeAttachmentLog(message, 'info', {
        taskId: String(task._id),
        fileIds: ids.map((id) => id.toHexString()),
        attachments: Array.isArray(task.attachments)
          ? task.attachments.length
          : 0,
        action,
      });
    } catch (error) {
      await writeAttachmentLog(
        `Ошибка логирования вложений задачи ${String(task?._id ?? 'unknown')}`,
        'error',
        { error: (error as Error).message, action },
      ).catch(() => undefined);
    }
  }

  async create(data: Partial<TaskDocument> = {}, userId?: number) {
    const payload = data ?? {};
    applyIntakeRules(payload);
    if (payload.due_date && !payload.remind_at)
      payload.remind_at = payload.due_date;
    this.applyCargoMetrics(payload);
    await this.applyRouteInfo(payload);
    try {
      const task =
        userId === undefined
          ? await this.repo.createTask(payload)
          : await this.repo.createTask(payload, userId);
      await clearRouteCache();
      await this.logAttachmentSync(
        'create',
        task,
        Array.isArray(task.attachments) && task.attachments.length > 0,
      );
      return task;
    } catch (error) {
      await writeAttachmentLog('Ошибка создания задачи с вложениями', 'error', {
        error: (error as Error).message,
      }).catch(() => undefined);
      throw error;
    }
  }

  get(filters: TaskFilters, page?: number, limit?: number) {
    return this.repo.getTasks(filters, page, limit);
  }

  getById(id: string) {
    return this.repo.getTask(id);
  }

  async update(id: string, data: Partial<TaskDocument> = {}, userId: number) {
    const payload = data ?? {};
    this.applyCargoMetrics(payload);
    await this.applyRouteInfo(payload);
    try {
      const task = await this.repo.updateTask(id, payload, userId);
      await clearRouteCache();
      await this.logAttachmentSync(
        'update',
        task,
        Object.prototype.hasOwnProperty.call(payload, 'attachments'),
      );
      return task;
    } catch (error) {
      await writeAttachmentLog('Ошибка обновления вложений задачи', 'error', {
        taskId: id,
        error: (error as Error).message,
      }).catch(() => undefined);
      throw error;
    }
  }

  applyCargoMetrics(data: Partial<TaskDocument> = {}) {
    const target = data as Record<string, unknown>;
    const length = toNumeric(data.cargo_length_m);
    const width = toNumeric(data.cargo_width_m);
    const height = toNumeric(data.cargo_height_m);
    const weight = toNumeric(data.cargo_weight_kg);
    const volume = toNumeric(data.cargo_volume_m3);
    const paymentAmount = toNumeric(data.payment_amount);

    setMetric(target, 'cargo_length_m',
      length !== undefined ? roundValue(length) : undefined);
    setMetric(target, 'cargo_width_m',
      width !== undefined ? roundValue(width) : undefined);
    setMetric(target, 'cargo_height_m',
      height !== undefined ? roundValue(height) : undefined);
    setMetric(target, 'cargo_weight_kg',
      weight !== undefined ? roundValue(weight, 2) : undefined);
    setMetric(target, 'payment_amount',
      paymentAmount !== undefined ? roundValue(paymentAmount, 2) : undefined);

    if (
      length !== undefined &&
      width !== undefined &&
      height !== undefined
    ) {
      setMetric(
        target,
        'cargo_volume_m3',
        roundValue(length * width * height),
      );
    } else {
      setMetric(
        target,
        'cargo_volume_m3',
        volume !== undefined ? roundValue(volume) : undefined,
      );
    }
  }

  async applyRouteInfo(data: Partial<TaskDocument> = {}) {
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

  async addTime(id: string, minutes: number) {
    const task = await this.repo.addTime(id, minutes);
    await clearRouteCache();
    return task;
  }

  async bulk(ids: string[], data: Partial<TaskDocument>) {
    await this.repo.bulkUpdate(ids, data);
    await clearRouteCache();
  }

  summary(filters: SummaryFilters) {
    return this.repo.summary(filters);
  }

  async remove(id: string) {
    const task = await this.repo.deleteTask(id);
    await clearRouteCache();
    return task;
  }

  mentioned(userId: string) {
    return this.repo.listMentionedTasks(userId);
  }
}

export default TasksService;
