// Централизованные функции работы с MongoDB для всего проекта
// Основные модули: mongoose модели, wgLogEngine, roleCache
import {
  Task,
  Archive,
  User,
  Role,
  File,
  type Attachment,
  TaskDocument,
  TaskAttrs,
  UserDocument,
  RoleDocument,
  RoleAttrs,
  TaskTemplate,
  TaskTemplateDocument,
  HistoryEntry,
  Comment,
  type TaskKind,
} from './model';
import { FleetVehicle } from './models/fleet';
import * as logEngine from '../services/wgLogEngine';
import { resolveRoleId } from './roleCache';
import { Types, PipelineStage, Query } from 'mongoose';
import {
  ACCESS_ADMIN,
  ACCESS_MANAGER,
  ACCESS_TASK_DELETE,
  ACCESS_USER,
} from '../utils/accessMask';
import { coerceAttachments, extractAttachmentIds } from '../utils/attachments';
import { deleteFilesForTask } from '../services/dataStorage';

function escapeRegex(text: string): string {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Отфильтровывает ключи с операторами, чтобы предотвратить NoSQL-инъекции
function sanitizeUpdate<T extends Record<string, unknown>>(
  data: T,
): Partial<T> {
  const res: Partial<T> = {};
  if (data && typeof data === 'object') {
    Object.entries(data).forEach(([k, v]) => {
      if (typeof k === 'string' && !k.startsWith('$') && !k.includes('.')) {
        (res as Record<string, unknown>)[k] = v;
      }
    });
  }
  return res;
}

function normalizeAttachmentsField(
  target: Record<string, unknown>,
): void {
  if (!target || typeof target !== 'object') return;
  if (!Object.prototype.hasOwnProperty.call(target, 'attachments')) return;
  const normalized = coerceAttachments(target.attachments);
  if (normalized === undefined) {
    delete target.attachments;
    return;
  }
  target.attachments = normalized;
}

const TRANSPORT_REQUIRED_TYPES = new Set(['Легковой', 'Грузовой']);

const isTransportRequired = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  return TRANSPORT_REQUIRED_TYPES.has(value.trim());
};

const toObjectId = (value: unknown): Types.ObjectId | null => {
  if (value instanceof Types.ObjectId) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed && Types.ObjectId.isValid(trimmed)) {
      return new Types.ObjectId(trimmed);
    }
  }
  return null;
};

async function normalizeTransportFields(
  payload: Partial<TaskDocument> & Record<string, unknown>,
  previous: TaskDocument | null,
): Promise<void> {
  const typeCandidate = Object.prototype.hasOwnProperty.call(payload, 'transport_type')
    ? payload.transport_type
    : previous?.transport_type;
  const requiresTransport = isTransportRequired(typeCandidate);
  if (!requiresTransport) {
    const transportFields: Array<keyof TaskDocument> = [
      'transport_driver_id',
      'transport_driver_name',
      'transport_vehicle_id',
      'transport_vehicle_name',
      'transport_vehicle_registration',
    ];
    transportFields.forEach((field) => {
      const hasOwnValue = Object.prototype.hasOwnProperty.call(payload, field);
      const previousValue =
        previous != null
          ? (previous as unknown as Record<string, unknown>)[field as string]
          : undefined;
      if (hasOwnValue) {
        (payload as Record<string, unknown>)[field] = null;
      } else if (previousValue !== null && previousValue !== undefined) {
        (payload as Record<string, unknown>)[field] = null;
      }
    });
    return;
  }

  const driverFieldProvided = Object.prototype.hasOwnProperty.call(
    payload,
    'transport_driver_id',
  );
  if (driverFieldProvided) {
    const driverRaw = payload.transport_driver_id as unknown;
    const driverValue =
      typeof driverRaw === 'number'
        ? driverRaw
        : typeof driverRaw === 'string'
        ? Number(driverRaw.trim())
        : Number.NaN;
    payload.transport_driver_id = Number.isFinite(driverValue) ? driverValue : null;
  } else if (previous) {
    payload.transport_driver_id = previous.transport_driver_id ?? null;
  }

  const driverNameProvided = Object.prototype.hasOwnProperty.call(
    payload,
    'transport_driver_name',
  );
  if (driverNameProvided) {
    const rawName = payload.transport_driver_name as unknown;
    if (typeof rawName === 'string') {
      const trimmed = rawName.trim();
      payload.transport_driver_name = trimmed.length > 0 ? trimmed : null;
    } else {
      payload.transport_driver_name = null;
    }
  } else if (payload.transport_driver_id === null) {
    payload.transport_driver_name = null;
  } else if (
    previous &&
    typeof previous.transport_driver_id === 'number' &&
    Number.isFinite(previous.transport_driver_id) &&
    previous.transport_driver_id === payload.transport_driver_id
  ) {
    const prevName =
      typeof previous.transport_driver_name === 'string'
        ? previous.transport_driver_name.trim()
        : null;
    payload.transport_driver_name = prevName && prevName.length > 0 ? prevName : null;
  } else {
    payload.transport_driver_name = null;
  }

  const resolvedDriverId = driverFieldProvided
    ? typeof payload.transport_driver_id === 'number' &&
      Number.isFinite(payload.transport_driver_id)
      ? payload.transport_driver_id
      : null
    : typeof previous?.transport_driver_id === 'number' &&
        Number.isFinite(previous.transport_driver_id)
      ? previous.transport_driver_id
      : null;
  const currentDriverName =
    typeof payload.transport_driver_name === 'string' &&
    payload.transport_driver_name.trim().length > 0
      ? payload.transport_driver_name.trim()
      : null;

  if (resolvedDriverId !== null && !currentDriverName) {
    const driver = await User.findOne(
      { telegram_id: { $eq: resolvedDriverId } },
      { name: 1, username: 1 },
    )
      .lean<{ name?: string | null; username?: string | null }>()
      .exec();
    const resolvedName = driver
      ? (typeof driver.name === 'string' && driver.name.trim().length > 0
          ? driver.name.trim()
          : typeof driver.username === 'string' &&
            driver.username.trim().length > 0
          ? driver.username.trim()
          : null)
      : null;
    if (resolvedName) {
      payload.transport_driver_name = resolvedName;
    } else if (driverNameProvided) {
      payload.transport_driver_name = null;
    }
  }

  let vehicleId: Types.ObjectId | null = null;
  const vehicleFieldProvided = Object.prototype.hasOwnProperty.call(
    payload,
    'transport_vehicle_id',
  );
  if (vehicleFieldProvided) {
    vehicleId = toObjectId(payload.transport_vehicle_id);
    if (!vehicleId) {
      payload.transport_vehicle_id = null;
      payload.transport_vehicle_name = null;
      payload.transport_vehicle_registration = null;
    }
  } else if (previous?.transport_vehicle_id) {
    vehicleId = previous.transport_vehicle_id as Types.ObjectId;
    payload.transport_vehicle_id = previous.transport_vehicle_id;
    payload.transport_vehicle_name = previous.transport_vehicle_name ?? null;
    payload.transport_vehicle_registration =
      previous.transport_vehicle_registration ?? null;
  }

  if (vehicleId) {
    const vehicle = await FleetVehicle.findById(vehicleId).lean();
    if (!vehicle) {
      payload.transport_vehicle_id = null;
      payload.transport_vehicle_name = null;
      payload.transport_vehicle_registration = null;
      vehicleId = null;
    } else {
      payload.transport_vehicle_id = vehicle._id as Types.ObjectId;
      payload.transport_vehicle_name = vehicle.name;
      payload.transport_vehicle_registration = vehicle.registrationNumber;
    }
  }
}

const toTaskIdString = (
  current: TaskDocument | null,
  previous?: TaskDocument | null,
): string | null => {
  const idCandidate = current?._id ?? previous?._id;
  return idCandidate ? String(idCandidate) : null;
};

async function attachVehicle(
  vehicleId: string,
  taskId: string,
  taskTitle?: string,
): Promise<void> {
  const vehicle = await FleetVehicle.findById(vehicleId);
  if (!vehicle) return;
  const tasks = Array.isArray(vehicle.currentTasks)
    ? [...vehicle.currentTasks]
    : [];
  if (!tasks.includes(taskId)) {
    tasks.push(taskId);
    vehicle.currentTasks = tasks;
  }
  const history = Array.isArray(vehicle.transportHistory)
    ? [...vehicle.transportHistory]
    : [];
  const entry = history.find((item) => item.taskId === taskId);
  const now = new Date();
  if (entry) {
    entry.assignedAt = now;
    entry.removedAt = undefined;
    if (taskTitle) entry.taskTitle = taskTitle;
  } else {
    history.push({
      taskId,
      taskTitle,
      assignedAt: now,
    });
  }
  vehicle.transportHistory = history;
  await vehicle.save();
}

async function detachVehicle(vehicleId: string, taskId: string): Promise<void> {
  const vehicle = await FleetVehicle.findById(vehicleId);
  if (!vehicle) return;
  if (Array.isArray(vehicle.currentTasks)) {
    vehicle.currentTasks = vehicle.currentTasks.filter((item) => item !== taskId);
  }
  if (Array.isArray(vehicle.transportHistory)) {
    const entry = vehicle.transportHistory.find(
      (item) => item.taskId === taskId && !item.removedAt,
    );
    if (entry) {
      entry.removedAt = new Date();
    }
  }
  await vehicle.save();
}

async function syncVehicleAssignments(
  previous: TaskDocument | null,
  current: TaskDocument | null,
): Promise<void> {
  const taskId = toTaskIdString(current, previous);
  if (!taskId) return;
  const prevRequires = previous ? isTransportRequired(previous.transport_type) : false;
  const nextRequires = current ? isTransportRequired(current.transport_type) : false;

  const prevVehicleId =
    prevRequires && previous?.transport_vehicle_id
      ? String(previous.transport_vehicle_id)
      : null;
  const nextVehicleId =
    nextRequires && current?.transport_vehicle_id
      ? String(current.transport_vehicle_id)
      : null;

  if (prevVehicleId && prevVehicleId !== nextVehicleId) {
    await detachVehicle(prevVehicleId, taskId);
  }
  if (nextVehicleId) {
    const title =
      typeof current?.title === 'string'
        ? current.title
        : typeof previous?.title === 'string'
        ? previous.title
        : undefined;
    await attachVehicle(nextVehicleId, taskId, title);
  } else if (prevVehicleId && !nextVehicleId) {
    await detachVehicle(prevVehicleId, taskId);
  }
}

async function safeSyncVehicleAssignments(
  previous: TaskDocument | null,
  current: TaskDocument | null,
): Promise<void> {
  try {
    await syncVehicleAssignments(previous, current);
  } catch (error) {
    const id = toTaskIdString(current, previous) ?? 'unknown';
    const message = error instanceof Error ? error.message : String(error);
    await logEngine
      .writeLog('Не удалось синхронизировать транспорт задачи', 'error', {
        taskId: id,
        error: message,
      })
      .catch(() => undefined);
  }
}

const ensureDate = (value: unknown): Date | undefined => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return undefined;
};

const pickNumber = (...values: unknown[]): number | undefined => {
  for (const candidate of values) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return undefined;
};

const pickString = (...values: unknown[]): string | undefined => {
  for (const candidate of values) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return undefined;
};

const buildAttachmentKey = (attachment: Attachment): string | null => {
  if (!attachment || typeof attachment.url !== 'string') {
    return null;
  }
  const trimmed = attachment.url.trim();
  if (!trimmed) {
    return null;
  }
  const [pathPart] = trimmed.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  if (last && Types.ObjectId.isValid(last)) {
    return `file:${last}`;
  }
  return `url:${trimmed}`;
};

const resolveAttachmentFileId = (attachment: Attachment): string | null => {
  const key = buildAttachmentKey(attachment);
  if (key && key.startsWith('file:')) {
    return key.slice(5);
  }
  return null;
};

type LeanFileDoc = {
  _id: unknown;
  name?: string;
  thumbnailPath?: string;
  userId?: number;
  type?: string;
  size?: number;
  uploadedAt?: Date | string | number;
};

const mergeAttachmentSources = (
  current: Attachment,
  sources: {
    file?: LeanFileDoc;
    previous?: Attachment;
  },
): Attachment => {
  const uploadedAt =
    ensureDate(current.uploadedAt) ||
    ensureDate(sources.previous?.uploadedAt) ||
    ensureDate(sources.file?.uploadedAt) ||
    new Date();
  const thumbnailFromFile =
    sources.file?.thumbnailPath && sources.file.thumbnailPath.trim()
      ? `/uploads/${sources.file.thumbnailPath}`
      : undefined;
  return {
    ...sources.previous,
    ...current,
    name:
      pickString(current.name, sources.previous?.name, sources.file?.name) ??
      current.name,
    url: sources.file ? `/api/v1/files/${String(sources.file._id)}` : current.url,
    thumbnailUrl:
      pickString(current.thumbnailUrl, sources.previous?.thumbnailUrl) ??
      thumbnailFromFile,
    uploadedBy:
      pickNumber(current.uploadedBy, sources.previous?.uploadedBy, sources.file?.userId) ??
      current.uploadedBy,
    uploadedAt,
    type:
      pickString(current.type, sources.previous?.type, sources.file?.type) ??
      (current.type ?? 'application/octet-stream'),
    size:
      pickNumber(current.size, sources.previous?.size, sources.file?.size) ??
      current.size,
  } as Attachment;
};

async function enrichAttachmentsFromContent(
  data: Partial<TaskDocument> & Record<string, unknown>,
  previous: TaskDocument | null,
): Promise<Attachment[] | undefined> {
  const attachmentsRaw = data.attachments as Attachment[] | undefined;
  if (attachmentsRaw === undefined) {
    return undefined;
  }
  if (!Array.isArray(attachmentsRaw) || attachmentsRaw.length === 0) {
    return [];
  }
  const attachments = attachmentsRaw.map((item) => ({ ...item })) as Attachment[];
  const previousByKey = new Map<string, Attachment>();
  if (previous && Array.isArray(previous.attachments)) {
    previous.attachments.forEach((item) => {
      const key = buildAttachmentKey(item as Attachment);
      if (key) {
        previousByKey.set(key, item as Attachment);
      }
    });
  }
  const fileIds = new Set<string>();
  const attachmentFileMap = new Map<number, string>();
  attachments.forEach((attachment, index) => {
    const fileId = resolveAttachmentFileId(attachment);
    if (fileId) {
      fileIds.add(fileId);
      attachmentFileMap.set(index, fileId);
    }
  });
  const filesMap = new Map<string, LeanFileDoc>();
  const fileModel = File as typeof File | undefined;
  if (fileIds.size > 0 && fileModel && typeof fileModel.find === 'function') {
    const objectIds = Array.from(fileIds).map((id) => new Types.ObjectId(id));
    const docs = await fileModel.find({ _id: { $in: objectIds } }).lean();
    docs.forEach((doc) => {
      filesMap.set(String(doc._id), doc);
    });
  }
  attachments.forEach((attachment, index) => {
    const key = buildAttachmentKey(attachment);
    const prevAttachment = key ? previousByKey.get(key) : undefined;
    const fileId = attachmentFileMap.get(index);
    const fileDoc = fileId ? filesMap.get(fileId) : undefined;
    attachments[index] = mergeAttachmentSources(attachment, {
      file: fileDoc,
      previous: prevAttachment,
    });
  });
  return attachments;

}

const REQUEST_TYPE_NAME = 'Заявка';

const detectTaskKind = (
  task: Pick<TaskDocument, 'kind' | 'task_type'>,
): TaskKind => {
  const rawKind =
    typeof task.kind === 'string' ? task.kind.trim().toLowerCase() : '';
  if (rawKind === 'request') {
    return 'request';
  }
  const typeLabel =
    typeof task.task_type === 'string' ? task.task_type.trim() : '';
  return typeLabel === REQUEST_TYPE_NAME ? 'request' : 'task';
};

export interface UpdateTaskStatusOptions {
  source?: 'web' | 'telegram';
}

async function syncTaskAttachments(
  taskId: Types.ObjectId,
  attachments: TaskDocument['attachments'] | undefined,
  userId?: number,
): Promise<void> {
  if (attachments === undefined) return;
  const fileModel = File as typeof File | undefined;
  if (!fileModel) {
    await logEngine
      .writeLog(
        `Модель файлов недоступна, пропускаем обновление вложений задачи ${String(
          taskId,
        )}`,
        'warn',
        { taskId: String(taskId), userId },
      )
      .catch(() => undefined);
    return;
  }
  if (typeof fileModel.updateMany !== 'function') {
    await logEngine
      .writeLog(
        `Метод updateMany отсутствует у модели файлов, пропускаем обновление вложений задачи ${String(
          taskId,
        )}`,
        'warn',
        { taskId: String(taskId), userId },
      )
      .catch(() => undefined);
    return;
  }
  const fileIds = extractAttachmentIds(attachments);
  const idsForLog = fileIds.map((id) => id.toHexString());
  try {
    if (fileIds.length === 0) {
      await fileModel.updateMany(
        { taskId },
        { $unset: { taskId: '', draftId: '' } },
      );
      return;
    }
    const filter: Record<string, unknown> = {
      _id: { $in: fileIds },
    };
    if (userId !== undefined) {
      filter.$or = [{ userId }, { taskId }];
    }
    await fileModel.updateMany(filter, {
      $set: { taskId },
      $unset: { draftId: '' },
    });
    await fileModel.updateMany(
      { taskId, _id: { $nin: fileIds } },
      { $unset: { taskId: '', draftId: '' } },
    );
  } catch (error) {
    await logEngine.writeLog(
      `Ошибка обновления вложений задачи ${String(taskId)}`,
      'error',
      {
        taskId: String(taskId),
        fileIds: idsForLog,
        error: (error as Error).message,
      },
    );
    throw error;
  }
}

// Возвращает уровень доступа по имени роли
export function accessByRole(role: string): number {
  switch (role) {
    case 'admin':
      return ACCESS_ADMIN | ACCESS_MANAGER;
    case 'manager':
      return ACCESS_MANAGER;
    default:
      return ACCESS_USER;
  }
}

export async function createTask(
  data: Partial<TaskDocument>,
  userId?: number,
): Promise<TaskDocument> {
  const payload: Partial<TaskDocument> = data ? { ...data } : {};
  await normalizeTransportFields(
    payload as Partial<TaskDocument> & Record<string, unknown>,
    null,
  );
  normalizeAttachmentsField(payload as Record<string, unknown>);
  const enrichedAttachments = await enrichAttachmentsFromContent(payload, null);
  if (enrichedAttachments !== undefined) {
    (payload as Partial<TaskDocument>).attachments =
      enrichedAttachments as TaskDocument['attachments'];
  }
  const entry = {
    changed_at: new Date(),
    changed_by: payload.created_by || 0,
    changes: { from: {}, to: payload },
  };
  const task = await Task.create({ ...payload, history: [entry] });
  await syncTaskAttachments(task._id as Types.ObjectId, task.attachments, userId);
  await safeSyncVehicleAssignments(null, task);
  return task;
}

export async function getTask(id: string): Promise<TaskDocument | null> {
  return Task.findById(id);
}

export async function listMentionedTasks(
  userId: number,
): Promise<TaskDocument[]> {
  return Task.find({
    $or: [
      { assigned_user_id: userId },
      { controller_user_id: userId },
      { controllers: userId },
      { assignees: userId },
      { created_by: userId },
      { 'comments.author_id': userId },
      { transport_driver_id: userId },
    ],
  });
}

export async function updateTask(
  id: string,
  fields: Partial<TaskDocument>,
  userId: number,
): Promise<TaskDocument | null> {
  const data = sanitizeUpdate(fields);
  const prev = await Task.findById(id);
  if (!prev) return null;
  await normalizeTransportFields(
    data as Partial<TaskDocument> & Record<string, unknown>,
    prev,
  );
  if (Object.prototype.hasOwnProperty.call(data, 'kind')) {
    delete (data as Record<string, unknown>).kind;
  }
  normalizeAttachmentsField(data as Record<string, unknown>);
  const enrichedAttachments = await enrichAttachmentsFromContent(
    data as Partial<TaskDocument> & Record<string, unknown>,
    prev,
  );
  if (enrichedAttachments !== undefined) {
    (data as Partial<TaskDocument>).attachments =
      enrichedAttachments as TaskDocument['attachments'];
  }

  const kind = detectTaskKind(prev);
  const creatorId = Number(prev.created_by);
  const isCreator = Number.isFinite(creatorId) && creatorId === userId;
  const assignedUserId =
    typeof prev.assigned_user_id === 'number' ? prev.assigned_user_id : undefined;
  const assignees = Array.isArray(prev.assignees)
    ? prev.assignees
        .map((candidate) => Number(candidate))
        .filter((candidate) => Number.isFinite(candidate))
    : [];
  const isExecutor =
    (typeof assignedUserId === 'number' && assignedUserId === userId) ||
    assignees.includes(userId);
  const shouldAssertStatus =
    typeof prev.status === 'string' && prev.status === 'Новая';
  if (Object.prototype.hasOwnProperty.call(data, 'status')) {
    const nextStatus = data.status as TaskDocument['status'];
    if (nextStatus === 'Новая') {
      (data as Record<string, unknown>).in_progress_at = null;
    } else if (nextStatus === 'Отменена') {
      if (kind === 'task' && !isCreator) {
        const err = new Error(
          'Статус «Отменена» может установить только создатель задачи.',
        );
        (err as Error & { code?: string }).code = 'TASK_CANCEL_FORBIDDEN';
        throw err;
      }
      if (kind === 'request' && !isCreator && !isExecutor) {
        const err = new Error(
          'Отменить заявку могут только исполнитель или создатель.',
        );
        (err as Error & { code?: string }).code =
          'TASK_REQUEST_CANCEL_FORBIDDEN';
        throw err;
      }
    }
  }
  const from: Record<string, unknown> = {};
  const to: Record<string, unknown> = {};
  const shouldAutoAppendComment =
    Object.prototype.hasOwnProperty.call(data, 'comment') &&
    !Object.prototype.hasOwnProperty.call(data, 'comments');
  if (shouldAutoAppendComment) {
    const nextComment =
      typeof data.comment === 'string' ? data.comment.trim() : '';
    const previousComment =
      typeof prev.comment === 'string' ? prev.comment.trim() : '';
    if (nextComment && nextComment !== previousComment) {
      const commentEntry = {
        author_id: userId,
        text: nextComment,
        created_at: new Date(),
      } satisfies Comment;
      const existing = Array.isArray(prev.comments)
        ? (prev.comments as Comment[])
        : [];
      data.comments = [...existing, commentEntry];
    }
  }
  Object.entries(data).forEach(([k, v]) => {
    const oldVal = (prev as unknown as Record<string, unknown>)[k];
    if (oldVal !== v) {
      from[k] = oldVal;
      to[k] = v as unknown;
    }
  });
  if (Object.keys(to).length === 0) {
    return prev;
  }
  const entry = {
    changed_at: new Date(),
    changed_by: userId,
    changes: { from, to },
  };
  const query: Record<string, unknown> = { _id: prev._id };
  if (shouldAssertStatus) {
    query.status = 'Новая';
  }
  const updated = await Task.findOneAndUpdate(
    query,
    {
      $set: data,
      $push: { history: entry },
    },
    { new: true },
  );
  if (updated && Object.prototype.hasOwnProperty.call(fields, 'attachments')) {
    await syncTaskAttachments(updated._id as Types.ObjectId, updated.attachments, userId);
  } else if (updated && enrichedAttachments !== undefined) {
    await syncTaskAttachments(updated._id as Types.ObjectId, updated.attachments, userId);
  }
  if (updated) {
    await safeSyncVehicleAssignments(prev, updated);
  }
  return updated;
}

export async function updateTaskStatus(
  id: string,
  status: TaskDocument['status'],
  userId: number,
  options: UpdateTaskStatusOptions = {},
): Promise<TaskDocument | null> {
  const existing = await Task.findById(id);
  if (!existing) return null;
  const source = options.source ?? 'web';
  const kind = detectTaskKind(existing);
  const currentStatus =
    typeof existing.status === 'string'
      ? (existing.status as TaskDocument['status'])
      : undefined;
  const assignedUserId =
    typeof existing.assigned_user_id === 'number'
      ? existing.assigned_user_id
      : undefined;
  const assignees = Array.isArray(existing.assignees)
    ? existing.assignees.map((value: unknown) => Number(value))
    : [];
  const hasAssignments =
    typeof assignedUserId === 'number' || assignees.length > 0;
  const isExecutor =
    (typeof assignedUserId === 'number' && assignedUserId === userId) ||
    assignees.includes(userId);
  const creatorId = Number(existing.created_by);
  const isCreator = Number.isFinite(creatorId) && creatorId === userId;
  let allowCreatorCancellation = false;
  if (status === 'Отменена') {
    if (kind === 'task') {
      if (!isCreator) {
        const err = new Error(
          'Статус «Отменена» может установить только создатель задачи.',
        );
        (err as Error & { code?: string }).code = 'TASK_CANCEL_FORBIDDEN';
        throw err;
      }
      if (source !== 'web') {
        const err = new Error(
          'Отмена задачи в Telegram недоступна. Используйте веб-форму.',
        );
        (err as Error & { code?: string }).code =
          'TASK_CANCEL_SOURCE_FORBIDDEN';
        throw err;
      }
      allowCreatorCancellation = true;
    } else {
      if (!isCreator && !isExecutor) {
        const err = new Error(
          'Отменить заявку могут только исполнитель или создатель.',
        );
        (err as Error & { code?: string }).code =
          'TASK_REQUEST_CANCEL_FORBIDDEN';
        throw err;
      }
      if (isCreator) {
        allowCreatorCancellation = true;
      }
    }
  }
  if (hasAssignments && !isExecutor && !(status === 'Отменена' && allowCreatorCancellation)) {
    throw new Error('Нет прав на изменение статуса задачи');
  }
  if (status === 'Выполнена' && currentStatus) {
    const allowedCompletionSources: TaskDocument['status'][] = [
      'Новая',
      'В работе',
      'Отменена',
      'Выполнена',
    ];
    if (!allowedCompletionSources.includes(currentStatus)) {
      const err = new Error(
        'Статус «Выполнена» доступен только после этапа «В работе»',
      );
      (err as Error & { code?: string }).code = 'TASK_STATUS_INVALID';
      throw err;
    }
  }
  const isCompleted = status === 'Выполнена' || status === 'Отменена';
  const hasInProgressValue = existing.in_progress_at instanceof Date;
  const needsInProgressStart = status === 'В работе' && !hasInProgressValue;
  const needsInProgressReset =
    status === 'Новая' && existing.in_progress_at != null;
  const hasCompletedValue = existing.completed_at instanceof Date;
  const needsCompletedSet = isCompleted && !hasCompletedValue;
  const needsCompletedReset = !isCompleted && hasCompletedValue;
  if (
    existing.status === status &&
    !needsInProgressStart &&
    !needsInProgressReset &&
    !needsCompletedSet &&
    !needsCompletedReset
  ) {
    return existing;
  }
  const update: Partial<TaskDocument> = { status };
  if (status === 'В работе') {
    update.in_progress_at = existing.in_progress_at ?? new Date();
  } else if (status === 'Новая' && needsInProgressReset) {
    update.in_progress_at = null;
  }
  if (isCompleted) {
    update.completed_at = existing.completed_at ?? new Date();
  } else if (needsCompletedReset) {
    update.completed_at = null;
  }
  return updateTask(id, update, userId);
}

export interface TaskFilters {
  status?: string;
  assignees?: (string | number)[];
  from?: string | Date;
  to?: string | Date;
  kanban?: boolean;
  kind?: TaskKind;
}

export async function getTasks(
  filters: TaskFilters = {},
  page?: number,
  limit?: number,
): Promise<{ tasks: TaskDocument[]; total: number }> {
  const isQuery = (v: unknown): v is Query<TaskDocument[], TaskDocument> =>
    typeof v === 'object' && v !== null && 'exec' in v;
  if (filters.kanban) {
    const kindFilter =
      filters.kind === 'request' ? 'request' : 'task';
    const res = Task.find({ kind: kindFilter }) as unknown;
    if (isQuery(res)) {
      const list = await res.sort('-createdAt').exec();
      return { tasks: list, total: list.length };
    }
    const list = res as TaskDocument[];
    return { tasks: list, total: list.length };
  }
  const q: Record<string, unknown> = {};
  if (filters.kind === 'task' || filters.kind === 'request') {
    q.kind = filters.kind;
  }
  if (filters.status) q.status = { $eq: filters.status };
  if (filters.assignees && Array.isArray(filters.assignees)) {
    q.assignees = {
      $in: filters.assignees.map((a) => String(a)),
    };
  }
  if (filters.from || filters.to) q.createdAt = {} as Record<string, Date>;
  if (filters.from)
    (q.createdAt as Record<string, Date>).$gte = new Date(filters.from);
  if (filters.to)
    (q.createdAt as Record<string, Date>).$lte = new Date(filters.to);
  const res = Task.find(q) as unknown;
  if (isQuery(res)) {
    let query = res.sort('-createdAt');
    const count = await Task.countDocuments(q);
    if (limit) {
      const p = Number(page) || 1;
      const l = Number(limit) || 20;
      query = query.skip((p - 1) * l).limit(l);
    }
    const list = await query.exec();
    return { tasks: list, total: count };
  }
  const list = res as TaskDocument[];
  return { tasks: list, total: list.length };
}

export interface RoutesFilters {
  status?: string;
  from?: Date;
  to?: Date;
}

export async function listRoutes(
  filters: RoutesFilters = {},
): Promise<TaskDocument[]> {
  const q: Record<string, unknown> = {};
  if (filters.status) q.status = { $eq: filters.status };
  if (filters.from || filters.to) q.createdAt = {} as Record<string, Date>;
  if (filters.from) (q.createdAt as Record<string, Date>).$gte = filters.from;
  if (filters.to) (q.createdAt as Record<string, Date>).$lte = filters.to;
  return Task.find(q).select(
    'startCoordinates finishCoordinates route_distance_km status createdAt',
  );
}

export async function searchTasks(text: string): Promise<TaskDocument[]> {
  const safe = escapeRegex(text);
  return Task.find({
    $or: [
      { title: { $regex: safe, $options: 'i' } },
      { task_description: { $regex: safe, $options: 'i' } },
    ],
  }).limit(10);
}

export async function addTime(
  id: string,
  minutes: number,
  userId = 0,
): Promise<TaskDocument | null> {
  const task = await Task.findById(id);
  if (!task) return null;
  const before = task.time_spent || 0;
  task.time_spent = before + minutes;
  task.history = [
    ...(task.history || []),
    {
      changed_at: new Date(),
      changed_by: userId,
      changes: {
        from: { time_spent: before },
        to: { time_spent: task.time_spent },
      },
    },
  ];
  await task.save();
  return task;
}

export async function bulkUpdate(
  ids: string[],
  data: Partial<TaskDocument>,
): Promise<void> {
  const payload: Partial<TaskDocument> = { ...data };
  if (Object.prototype.hasOwnProperty.call(payload, 'kind')) {
    delete (payload as Record<string, unknown>).kind;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    const status = payload.status;
    const isCompleted = status === 'Выполнена' || status === 'Отменена';
    if (status === 'В работе') {
      payload.in_progress_at = new Date();
    } else if (status === 'Новая') {
      payload.in_progress_at = null;
    }
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
  await Task.updateMany(
    { _id: { $in: ids } },
    {
      $set: payload,
      $push: {
        history: {
          changed_at: new Date(),
          changed_by: 0,
          changes: { from: {}, to: payload },
        },
      },
    },
  );
}

export async function deleteTask(
  id: string,
  actorId?: number,
): Promise<TaskDocument | null> {
  const doc = await Task.findByIdAndDelete(id);
  if (!doc) return null;
  const data = doc.toObject();
  const attachments = Array.isArray(data.attachments)
    ? (data.attachments as Attachment[])
    : [];
  const fileIds = extractAttachmentIds(attachments);
  await deleteFilesForTask(doc._id as Types.ObjectId, fileIds);
  const fallbackUserId =
    typeof data.created_by === 'number' && Number.isFinite(data.created_by)
      ? data.created_by
      : 0;
  if (Array.isArray(data.history) && data.history.length > 0) {
    const normalized = data.history.map((entry: HistoryEntry | null | undefined) => {
      if (entry && typeof entry === 'object') {
        const withFallback = { ...entry } as HistoryEntry & {
          changed_by?: unknown;
        };
        const changedBy = withFallback.changed_by;
        if (typeof changedBy !== 'number' || !Number.isFinite(changedBy)) {
          withFallback.changed_by = fallbackUserId;
        }
        return withFallback as HistoryEntry;
      }
      return {
        changed_at: new Date(),
        changed_by: fallbackUserId,
        changes: { from: {}, to: {} },
      } satisfies HistoryEntry;
    });
    data.history = normalized;
  }
  (data as unknown as Record<string, unknown>).request_id = `${
    (data as unknown as Record<string, unknown>).request_id
  }-DEL`;
  (data as unknown as Record<string, unknown>).task_number = (
    data as unknown as Record<string, unknown>
  ).request_id;
  (data as unknown as Record<string, unknown>).archived_at = new Date();
  if (typeof actorId === 'number' && Number.isFinite(actorId)) {
    (data as unknown as Record<string, unknown>).archived_by = actorId;
  }
  await Archive.create(data);
  return doc;
}

type LeanArchiveTask = (TaskAttrs & {
  _id: Types.ObjectId;
  archived_at?: Date;
  archived_by?: number;
  createdAt?: Date;
  updatedAt?: Date;
}) &
  Record<string, unknown>;

export interface ArchiveListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function listArchivedTasks(
  params: ArchiveListParams = {},
): Promise<{
  items: LeanArchiveTask[];
  total: number;
  page: number;
  pages: number;
}> {
  const pageRaw = Number(params.page);
  const limitRaw = Number(params.limit);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 200) : 25;
  const filter: Record<string, unknown> = {};
  const search = typeof params.search === 'string' ? params.search.trim() : '';
  if (search) {
    const safe = escapeRegex(search);
    filter.$or = [
      { request_id: { $regex: safe, $options: 'i' } },
      { task_number: { $regex: safe, $options: 'i' } },
      { title: { $regex: safe, $options: 'i' } },
    ];
  }
  const query = Archive.find(filter)
    .sort({ archived_at: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean<LeanArchiveTask[]>();
  const [items, total] = await Promise.all([
    query,
    Archive.countDocuments(filter),
  ]);
  const pages = limit > 0 ? Math.ceil(total / limit) : 0;
  return { items, total, page, pages };
}

export async function purgeArchivedTasks(ids: string[]): Promise<number> {
  const normalized = Array.isArray(ids)
    ? ids
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id))
    : [];
  if (!normalized.length) {
    return 0;
  }
  const result = await Archive.deleteMany({ _id: { $in: normalized } });
  return typeof result.deletedCount === 'number' ? result.deletedCount : 0;
}

export interface SummaryFilters {
  status?: string;
  assignees?: number[];
  from?: Date;
  to?: Date;
  kind?: TaskKind;
}

export async function summary(
  filters: SummaryFilters = {},
): Promise<{ count: number; time: number }> {
  const match: Record<string, unknown> = {};
  if (filters.kind === 'task' || filters.kind === 'request') {
    match.kind = filters.kind;
  }
  if (filters.status) match.status = filters.status;
  if (filters.assignees) match.assignees = { $in: filters.assignees };
  if (filters.from || filters.to) match.createdAt = {} as Record<string, Date>;
  if (filters.from)
    (match.createdAt as Record<string, Date>).$gte = filters.from;
  if (filters.to) (match.createdAt as Record<string, Date>).$lte = filters.to;
  const pipeline: (PipelineStage | undefined)[] = [
    Object.keys(match).length ? { $match: match } : undefined,
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        time: { $sum: '$time_spent' },
      },
    },
  ];
  const res = await Task.aggregate(
    pipeline.filter((s): s is PipelineStage => Boolean(s)),
  );
  const { count = 0, time = 0 } = (res[0] || {}) as {
    count?: number;
    time?: number;
  };
  return { count, time };
}

interface GeneratedCredentials {
  telegramId: number;
  username: string;
}

function parseTelegramId(id?: string | number): number | undefined {
  if (id === undefined || id === null) return undefined;
  const asString = String(id).trim();
  if (!asString) return undefined;
  const numeric = Number(asString);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
    throw new Error('Invalid telegram_id');
  }
  return numeric;
}

async function ensureTelegramIdAvailable(id: number): Promise<void> {
  const exists = await User.exists({ telegram_id: id });
  if (exists) {
    throw new Error('Пользователь с таким ID уже существует');
  }
}

async function findNextTelegramId(): Promise<number> {
  const last = await User.findOne({}, { telegram_id: 1 })
    .sort({ telegram_id: -1 })
    .lean<{ telegram_id?: number }>()
    .exec();
  let candidate =
    typeof last?.telegram_id === 'number' && Number.isFinite(last.telegram_id)
      ? last.telegram_id + 1
      : 1;
  while (await User.exists({ telegram_id: candidate })) {
    candidate += 1;
    if (!Number.isFinite(candidate) || candidate > Number.MAX_SAFE_INTEGER) {
      throw new Error('Не удалось подобрать свободный ID');
    }
  }
  return candidate;
}

function normalizeUsernameValue(value?: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed || undefined;
}

async function ensureUsernameAvailable(username: string): Promise<void> {
  const exists = await User.exists({ username });
  if (exists) {
    throw new Error('Username уже используется');
  }
}

async function generateUsername(base: string): Promise<string> {
  let attempt = 0;
  let candidate = base;
  while (await User.exists({ username: candidate })) {
    attempt += 1;
    if (attempt > 1000) {
      throw new Error('Не удалось подобрать свободный username');
    }
    candidate = `${base}_${attempt}`;
  }
  return candidate;
}

export async function generateUserCredentials(
  id?: string | number,
  username?: string,
): Promise<GeneratedCredentials> {
  const parsedId = parseTelegramId(id);
  let telegramId: number;
  if (parsedId !== undefined) {
    await ensureTelegramIdAvailable(parsedId);
    telegramId = parsedId;
  } else {
    telegramId = await findNextTelegramId();
  }

  const normalizedUsername = normalizeUsernameValue(username);
  if (normalizedUsername) {
    await ensureUsernameAvailable(normalizedUsername);
    return { telegramId, username: normalizedUsername };
  }

  const base = `employee${telegramId}`;
  const generated = await generateUsername(base);
  return { telegramId, username: generated };
}

async function assertCredentialsAvailable({
  telegramId,
  username,
}: GeneratedCredentials): Promise<void> {
  await ensureTelegramIdAvailable(telegramId);
  await ensureUsernameAvailable(username);
}

export async function createUser(
  id: string | number,
  username?: string,
  roleId?: string,
  extra: Omit<Partial<UserDocument>, 'access' | 'role'> = {},
): Promise<UserDocument> {
  const credentials = await generateUserCredentials(id, username);
  await assertCredentialsAvailable(credentials);
  const { telegramId, username: safeUsername } = credentials;
  const email = `${telegramId}@telegram.local`;
  let role = 'user';
  let rId: Types.ObjectId | null = null;
  if (roleId) {
    if (!Types.ObjectId.isValid(roleId)) {
      throw new Error('Invalid roleId');
    }
    const dbRole = await Role.findById(roleId);
    if (dbRole) {
      role = dbRole.name || 'user';
      rId = dbRole._id as Types.ObjectId;
    }
  }
  if (!rId) {
    rId = await resolveRoleId('user');
    if (!rId) {
      throw new Error('Не найдена базовая роль user');
    }
    role = 'user';
  }
  const access = accessByRole(role);
  return User.create({
    telegram_id: telegramId,
    username: safeUsername,
    email,
    name: safeUsername,
    role,
    roleId: rId,
    access,
    ...extra,
  });
}

export async function getUser(
  id: string | number,
): Promise<UserDocument | null> {
  const telegramId = Number(id);
  if (Number.isNaN(telegramId)) return null;
  return User.findOne({ telegram_id: telegramId });
}

export async function listUsers(): Promise<UserDocument[]> {
  return User.find();
}

export async function removeUser(id: string | number): Promise<boolean> {
  const telegramId = Number(id);
  if (Number.isNaN(telegramId)) {
    return false;
  }
  const result = await User.deleteOne({ telegram_id: { $eq: telegramId } });
  return result.deletedCount === 1;
}

export async function getUsersMap(
  ids: Array<string | number> = [],
): Promise<Record<number, UserDocument>> {
  const numeric = ids.map((id) => Number(id)).filter((id) => !Number.isNaN(id));
  const list = await User.find({ telegram_id: { $in: numeric } });
  const map: Record<number, UserDocument> = {};
  list.forEach((u: UserDocument) => {
    map[u.telegram_id] = u;
  });
  return map;
}

export async function updateUser(
  id: string | number,
  data: Omit<Partial<UserDocument>, 'access'>,
): Promise<UserDocument | null> {
  const telegramId = Number(id);
  if (Number.isNaN(telegramId)) return null;
  const previous = await User.findOne(
    { telegram_id: { $eq: telegramId } },
    { access: 1 },
  )
    .lean<{ access?: number }>()
    .exec();
  const sanitized = sanitizeUpdate(data) as Partial<UserDocument>;
  delete sanitized.access;
  if (sanitized.roleId) {
    const rId = String(sanitized.roleId);
    if (!Types.ObjectId.isValid(rId)) throw new Error('Invalid roleId');
    const dbRole = await Role.findById(rId);
    if (dbRole) {
      const r = (dbRole.name as UserDocument['role']) || 'user';
      sanitized.role = r;
      sanitized.roleId = dbRole._id as Types.ObjectId;
      sanitized.access = accessByRole(r);
    }
  } else if (sanitized.role) {
    sanitized.access = accessByRole(sanitized.role);
    const resolved = await resolveRoleId(sanitized.role);
    if (resolved) {
      sanitized.roleId = resolved;
    } else {
      delete (sanitized as Record<string, unknown>).roleId;
    }
  }
  if (typeof sanitized.access === 'number') {
    const previousAccess =
      typeof previous?.access === 'number' ? previous.access : null;
    if (
      previousAccess !== null &&
      (previousAccess & ACCESS_TASK_DELETE) === ACCESS_TASK_DELETE
    ) {
      sanitized.access |= ACCESS_TASK_DELETE;
    }
  }
  return User.findOneAndUpdate(
    { telegram_id: { $eq: telegramId } },
    sanitized,
    { new: true },
  );
}

// Возвращает роли с вычисленным уровнем доступа
export interface RoleWithAccess extends RoleAttrs {
  _id: Types.ObjectId;
  access: number;
}

export async function listRoles(): Promise<RoleWithAccess[]> {
  const roles =
    await Role.find().lean<(RoleAttrs & { _id: Types.ObjectId })[]>();
  return roles.map((r: RoleAttrs & { _id: Types.ObjectId }) => ({
    ...r,
    access: accessByRole(r.name || ''),
  }));
}

export async function getRole(id: string): Promise<RoleDocument | null> {
  return Role.findById(id);
}

export async function updateRole(
  id: string,
  permissions: Array<string | number>,
): Promise<RoleDocument | null> {
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

export async function createTaskTemplate(
  data: Partial<TaskTemplateDocument>,
): Promise<TaskTemplateDocument> {
  return TaskTemplate.create(data);
}

export async function getTaskTemplate(
  id: string,
): Promise<TaskTemplateDocument | null> {
  return TaskTemplate.findById(id);
}

export async function listTaskTemplates(): Promise<TaskTemplateDocument[]> {
  return TaskTemplate.find();
}

export async function deleteTaskTemplate(
  id: string,
): Promise<TaskTemplateDocument | null> {
  return TaskTemplate.findByIdAndDelete(id);
}

export default {
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
  generateUserCredentials,
  getUser,
  listUsers,
  removeUser,
  getUsersMap,
  updateUser,
  listRoles,
  getRole,
  updateRole,
  writeLog: logEngine.writeLog,
  listLogs: logEngine.listLogs,
  searchTasks,
  createTaskTemplate,
  getTaskTemplate,
  listTaskTemplates,
  deleteTaskTemplate,
  listRoutes,
  listArchivedTasks,
  purgeArchivedTasks,
};
