// Сервис задач через репозиторий.
// Основные модули: db/queries, services/route, shared, logisticsEvents
import { getRouteDistance, clearRouteCache } from '../services/route';
import { generateRouteLink } from 'shared';
import { applyIntakeRules } from '../intake/rules';
import type { TaskDocument, HistoryEntry } from '../db/model';
import type { TaskFilters, SummaryFilters } from '../db/queries';
import { writeLog as writeAttachmentLog } from '../services/wgLogEngine';
import { extractAttachmentIds } from '../utils/attachments';
import { resolveTaskTypeTopicId } from '../services/taskTypeSettings';
import { ensureTaskLinksShort } from '../services/taskLinks';
import { notifyTasksChanged } from '../services/logisticsEvents';
import { FleetVehicle } from '../db/models/fleet';
import { updateFleetUsage } from '../services/fleetUsage';
import { Types } from 'mongoose';

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

const extractTaskId = (task: TaskDocument | null | undefined): string | null => {
  if (!task) {
    return null;
  }
  const rawId = (task as { _id?: unknown; id?: unknown })._id ?? (task as { id?: unknown }).id;
  if (typeof rawId === 'string' && rawId.trim()) {
    return rawId.trim();
  }
  if (rawId && typeof rawId === 'object' && 'toString' in rawId) {
    const converted = (rawId as { toString(): string }).toString();
    return converted.trim() ? converted.trim() : null;
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
    await this.applyDefaultTransportDriver(payload);
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
      const identifier = extractTaskId(task);
      if (identifier) {
        notifyTasksChanged('created', [identifier]);
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
      (payload as Record<string, unknown>).deadline_reminder_sent_at = undefined;
    }
    this.applyCargoMetrics(payload);
    await this.applyRouteInfo(payload);
    await ensureTaskLinksShort(payload);
    await this.applyTaskTypeTopic(payload);
    await this.applyDefaultTransportDriver(payload);
    try {
      const task = await this.repo.updateTask(id, payload, userId);
      if (task && payload.status === 'Выполнена') {
        const status =
          typeof (task as { status?: unknown }).status === 'string'
            ? ((task as { status: TaskDocument['status'] }).status)
            : undefined;
        const historyList = Array.isArray((task as { history?: unknown }).history)
          ? ((task as { history?: HistoryEntry[] }).history)
          : [];
        const lastChange = historyList.length
          ? historyList[historyList.length - 1]
          : undefined;
        const statusChangedToCompleted =
          status === 'Выполнена' &&
          (lastChange?.changes?.to?.status as TaskDocument['status'] | undefined) === 'Выполнена';
        if (statusChangedToCompleted) {
          const vehicleId = this.normalizeVehicleId(
            (task as { transport_vehicle_id?: unknown }).transport_vehicle_id,
          );
          const routeDistance =
            typeof (task as { route_distance_km?: unknown }).route_distance_km === 'number'
              ? ((task as { route_distance_km: number }).route_distance_km)
              : undefined;
          const taskId = extractTaskId(task) ?? id;
          if (vehicleId && typeof routeDistance === 'number' && Number.isFinite(routeDistance)) {
            await updateFleetUsage({
              taskId,
              vehicleId,
              routeDistanceKm: routeDistance,
            }).catch((error) => {
              console.error('Не удалось применить пробег транспорта', {
                taskId,
                vehicleId,
                routeDistanceKm: routeDistance,
                error,
              });
            });
          }
        }
      }
      await clearRouteCache();
      await this.logAttachmentSync(
        'update',
        task,
        Object.prototype.hasOwnProperty.call(payload, 'attachments'),
      );
      const identifier = extractTaskId(task);
      if (identifier) {
        notifyTasksChanged('updated', [identifier]);
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

  private normalizeVehicleId(value: unknown): string | null {
    if (!value) {
      return null;
    }
    if (value instanceof Types.ObjectId) {
      return value.toHexString();
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (
      typeof value === 'object' &&
      value !== null &&
      'toString' in value &&
      typeof (value as { toString?: unknown }).toString === 'function'
    ) {
      const converted = (value as { toString(): string }).toString();
      const trimmed = converted.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return null;
  }

  private async applyDefaultTransportDriver(
    data: Partial<TaskDocument> = {},
  ): Promise<void> {
    if (!data) return;
    const hasVehicleField = Object.prototype.hasOwnProperty.call(
      data,
      'transport_vehicle_id',
    );
    if (!hasVehicleField) {
      return;
    }
    const vehicleId = this.normalizeVehicleId(data.transport_vehicle_id);
    if (!vehicleId) {
      return;
    }
    const hasDriverField = Object.prototype.hasOwnProperty.call(
      data,
      'transport_driver_id',
    );
    if (hasDriverField) {
      const rawDriver = (data as Record<string, unknown>).transport_driver_id;
      if (
        rawDriver !== undefined &&
        rawDriver !== null &&
        !(typeof rawDriver === 'string' && rawDriver.trim().length === 0)
      ) {
        return;
      }
    }
    const vehicle = await FleetVehicle.findById(vehicleId)
      .select({ defaultDriverId: 1 })
      .lean<{ defaultDriverId?: number | null }>()
      .exec();
    if (
      !vehicle ||
      typeof vehicle.defaultDriverId !== 'number' ||
      !Number.isFinite(vehicle.defaultDriverId) ||
      vehicle.defaultDriverId <= 0
    ) {
      return;
    }
    (data as Record<string, unknown>).transport_driver_id = Math.trunc(
      vehicle.defaultDriverId,
    );
    if (
      Object.prototype.hasOwnProperty.call(data, 'transport_driver_name') &&
      ((data as Record<string, unknown>).transport_driver_name === '' ||
        (data as Record<string, unknown>).transport_driver_name === null)
    ) {
      delete (data as Record<string, unknown>).transport_driver_name;
    }
  }

  async addTime(id: string, minutes: number) {
    const task = await this.repo.addTime(id, minutes);
    await clearRouteCache();
    const identifier = extractTaskId(task);
    if (identifier) {
      notifyTasksChanged('updated', [identifier]);
    }
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
    const normalizedIds = ids.map((value) => String(value)).filter((value) => value.trim());
    if (normalizedIds.length) {
      notifyTasksChanged('bulk', normalizedIds);
    }
  }

  summary(filters: SummaryFilters) {
    return this.repo.summary(filters);
  }

  async remove(id: string, actorId?: number) {
    const task = await this.repo.deleteTask(id, actorId);
    await clearRouteCache();
    const identifier = extractTaskId(task);
    if (identifier) {
      notifyTasksChanged('deleted', [identifier]);
    }
    return task;
  }

  mentioned(userId: string) {
    return this.repo.listMentionedTasks(userId);
  }
}

export default TasksService;
