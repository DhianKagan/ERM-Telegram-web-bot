// Сервис задач через репозиторий.
// Основные модули: db/queries, services/route, shared
import { clearRouteCache } from '../services/route';
import { getOsrmDistance } from '../geo/osrm';
import { notifyTasksChanged } from '../services/logisticsEvents';
import { generateRouteLink } from 'shared';
import { applyIntakeRules } from '../intake/rules';
import type { TaskDocument } from '../db/model';
import type {
  TaskFilters,
  SummaryFilters,
  TasksChartResult,
} from '../db/queries';
import { writeLog as writeAttachmentLog } from '../services/wgLogEngine';
import { extractAttachmentIds } from '../utils/attachments';
import { resolveTaskTypeTopicId } from '../services/taskTypeSettings';
import { ensureTaskLinksShort } from '../services/taskLinks';

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
  chart(filters: SummaryFilters): Promise<TasksChartResult>;
  deleteTask(id: string, actorId?: number): Promise<TaskDocument | null>;
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
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const compact = trimmed.replace(/\s+/g, '').replace(/[\u2018\u2019']/g, '');
    if (!compact) {
      return undefined;
    }
    const hasComma = compact.includes(',');
    const hasDot = compact.includes('.');
    let normalized = compact;
    if (hasComma && hasDot) {
      normalized = compact.replace(/\./g, '').replace(/,/g, '.');
    } else if (hasComma) {
      normalized = compact.replace(/,/g, '.');
    }
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
  const keyName = key as string;
  const hasOriginalValue = Object.prototype.hasOwnProperty.call(
    target,
    keyName,
  );
  const rawValue = hasOriginalValue ? target[keyName] : undefined;

  if (value === undefined || Number.isNaN(value)) {
    if (hasOriginalValue) {
      if (rawValue === null) {
        target[keyName] = null;
        return;
      }
      if (typeof rawValue === 'string' && rawValue.trim() === '') {
        target[keyName] = null;
        return;
      }
      delete target[keyName];
      return;
    }
    delete target[keyName];
    return;
  }
  target[keyName] = value;
};

const normalizeTaskId = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(Math.trunc(value)) : null;
  }
  if (
    typeof value === 'object' &&
    'toString' in (value as { toString(): unknown })
  ) {
    const str = (value as { toString(): unknown }).toString();
    return typeof str === 'string' && str ? str : null;
  }
  return null;
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
    await ensureTaskLinksShort(payload);
    await this.applyTaskTypeTopic(payload);
    const normalizedUserId =
      typeof userId === 'number' && Number.isFinite(userId)
        ? userId
        : undefined;
    const attachmentsList = Array.isArray(payload.attachments)
      ? payload.attachments
      : [];
    if (normalizedUserId === undefined && attachmentsList.length > 0) {
      const fileIds = extractAttachmentIds(payload.attachments || []);
      try {
        await writeAttachmentLog(
          'Создание задачи с вложениями без идентификатора пользователя, активирован fallback',
          'warn',
          {
            attachments: attachmentsList.length,
            fileIds: fileIds.map((id) => id.toHexString()),
            fallback: true,
          },
        );
      } catch {
        /* игнорируем сбой логирования fallback */
      }
    }
    try {
      const task = await this.repo.createTask(payload, normalizedUserId);
      await clearRouteCache();
      await this.logAttachmentSync(
        'create',
        task,
        Array.isArray(task.attachments) && task.attachments.length > 0,
      );
      const taskId = normalizeTaskId(task?._id);
      if (taskId) {
        notifyTasksChanged('created', [taskId]);
      }
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
    if (Object.prototype.hasOwnProperty.call(payload, 'due_date')) {
      (payload as Record<string, unknown>).deadline_reminder_sent_at =
        undefined;
    }
    this.applyCargoMetrics(payload);
    await this.applyRouteInfo(payload);
    await ensureTaskLinksShort(payload);
    await this.applyTaskTypeTopic(payload);
    try {
      const task = await this.repo.updateTask(id, payload, userId);
      await clearRouteCache();
      await this.logAttachmentSync(
        'update',
        task,
        Object.prototype.hasOwnProperty.call(payload, 'attachments'),
      );
      const taskId = normalizeTaskId(task?._id) ?? normalizeTaskId(id);
      if (taskId) {
        notifyTasksChanged('updated', [taskId]);
      }
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

    setMetric(
      target,
      'cargo_length_m',
      length !== undefined ? roundValue(length) : undefined,
    );
    setMetric(
      target,
      'cargo_width_m',
      width !== undefined ? roundValue(width) : undefined,
    );
    setMetric(
      target,
      'cargo_height_m',
      height !== undefined ? roundValue(height) : undefined,
    );
    setMetric(
      target,
      'cargo_weight_kg',
      weight !== undefined ? roundValue(weight, 2) : undefined,
    );
    setMetric(
      target,
      'payment_amount',
      paymentAmount !== undefined ? roundValue(paymentAmount, 2) : undefined,
    );

    if (length !== undefined && width !== undefined && height !== undefined) {
      setMetric(target, 'cargo_volume_m3', roundValue(length * width * height));
    } else {
      setMetric(
        target,
        'cargo_volume_m3',
        volume !== undefined ? roundValue(volume) : undefined,
      );
    }
  }

  async applyRouteInfo(data: Partial<TaskDocument> = {}) {
    const target = data as Record<string, unknown>;
    const hasStartUpdate = Object.prototype.hasOwnProperty.call(
      target,
      'startCoordinates',
    );
    const hasFinishUpdate = Object.prototype.hasOwnProperty.call(
      target,
      'finishCoordinates',
    );
    const clearRouteDistance = () => {
      target.route_distance_km = null;
    };

    if (data.startCoordinates && data.finishCoordinates) {
      data.google_route_url = generateRouteLink(
        data.startCoordinates,
        data.finishCoordinates,
      );
      try {
        const distanceKm = await getOsrmDistance({
          start: data.startCoordinates,
          finish: data.finishCoordinates,
        });
        if (typeof distanceKm === 'number') {
          data.route_distance_km = distanceKm;
        } else {
          clearRouteDistance();
        }
      } catch {
        clearRouteDistance();
      }
      return;
    }
    if (hasStartUpdate || hasFinishUpdate) {
      clearRouteDistance();
    }
  }

  private async applyTaskTypeTopic(data: Partial<TaskDocument> = {}) {
    const typeValue = data.task_type;
    if (typeof typeValue !== 'string') {
      return;
    }
    const type = typeValue.trim();
    if (!type) {
      return;
    }
    try {
      const topicId = await resolveTaskTypeTopicId(type);
      if (typeof topicId === 'number') {
        data.telegram_topic_id = topicId;
      }
    } catch (error) {
      console.error(
        'Не удалось определить тему Telegram для типа задачи',
        error,
      );
    }
  }

  async addTime(id: string, minutes: number) {
    const task = await this.repo.addTime(id, minutes);
    await clearRouteCache();
    return task;
  }

  async bulk(ids: string[], data: Partial<TaskDocument>) {
    const payload = { ...(data ?? {}) } as Partial<TaskDocument>;
    if (Object.prototype.hasOwnProperty.call(payload, 'kind')) {
      delete (payload as Record<string, unknown>).kind;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
      const status = payload.status;
      const isCompleted = status === 'Выполнена' || status === 'Отменена';
      if (isCompleted) {
        if (!Object.prototype.hasOwnProperty.call(payload, 'completed_at')) {
          payload.completed_at = new Date();
        } else if (payload.completed_at === undefined) {
          payload.completed_at = new Date();
        }
      } else {
        payload.completed_at = null;
      }
    }
    await ensureTaskLinksShort(payload);
    await this.applyTaskTypeTopic(payload);
    await this.repo.bulkUpdate(ids, payload);
    await clearRouteCache();
  }

  summary(filters: SummaryFilters) {
    return this.repo.summary(filters);
  }

  chart(filters: SummaryFilters): Promise<TasksChartResult> {
    return this.repo.chart(filters);
  }

  async remove(id: string, actorId?: number) {
    const task = await this.repo.deleteTask(id, actorId);
    await clearRouteCache();
    const taskId = normalizeTaskId(task?._id) ?? normalizeTaskId(id);
    if (task && taskId) {
      notifyTasksChanged('deleted', [taskId]);
    }
    return task;
  }

  mentioned(userId: string) {
    return this.repo.listMentionedTasks(userId);
  }
}

export default TasksService;
