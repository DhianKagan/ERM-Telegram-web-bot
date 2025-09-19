// Централизованные функции работы с MongoDB для всего проекта
// Основные модули: mongoose модели, wgLogEngine, roleCache
import {
  Task,
  Archive,
  User,
  Role,
  TaskDocument,
  UserDocument,
  RoleDocument,
  RoleAttrs,
  TaskTemplate,
  TaskTemplateDocument,
  HistoryEntry,
} from './model';
import * as logEngine from '../services/wgLogEngine';
import { resolveRoleId } from './roleCache';
import { Types, PipelineStage, Query } from 'mongoose';
import { ACCESS_ADMIN, ACCESS_MANAGER, ACCESS_USER } from '../utils/accessMask';

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
): Promise<TaskDocument> {
  const entry = {
    changed_at: new Date(),
    changed_by: data.created_by || 0,
    changes: { from: {}, to: data },
  };
  return Task.create({ ...data, history: [entry] });
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
  const from: Record<string, unknown> = {};
  const to: Record<string, unknown> = {};
  Object.entries(data).forEach(([k, v]) => {
    const oldVal = (prev as unknown as Record<string, unknown>)[k];
    if (oldVal !== v) {
      from[k] = oldVal;
      to[k] = v as unknown;
    }
  });
  const entry = {
    changed_at: new Date(),
    changed_by: userId,
    changes: { from, to },
  };
  return Task.findByIdAndUpdate(
    id,
    {
      $set: data,
      $push: { history: entry },
    },
    { new: true },
  );
}

export async function updateTaskStatus(
  id: string,
  status: string,
  userId: number,
): Promise<TaskDocument | null> {
  return updateTask(id, { status } as Partial<TaskDocument>, userId);
}

export interface TaskFilters {
  status?: string;
  assignees?: (string | number)[];
  from?: string | Date;
  to?: string | Date;
  kanban?: boolean;
}

export async function getTasks(
  filters: TaskFilters = {},
  page?: number,
  limit?: number,
): Promise<{ tasks: TaskDocument[]; total: number }> {
  const isQuery = (v: unknown): v is Query<TaskDocument[], TaskDocument> =>
    typeof v === 'object' && v !== null && 'exec' in v;
  if (filters.kanban) {
    const res = Task.find({}) as unknown;
    if (isQuery(res)) {
      const list = await res.sort('-createdAt').exec();
      return { tasks: list, total: list.length };
    }
    const list = res as TaskDocument[];
    return { tasks: list, total: list.length };
  }
  const q: Record<string, unknown> = {};
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
  await Task.updateMany(
    { _id: { $in: ids } },
    {
      $set: data,
      $push: {
        history: {
          changed_at: new Date(),
          changed_by: 0,
          changes: { from: {}, to: data },
        },
      },
    },
  );
}

export async function deleteTask(id: string): Promise<TaskDocument | null> {
  const doc = await Task.findByIdAndDelete(id);
  if (!doc) return null;
  const data = doc.toObject();
  const fallbackUserId =
    typeof data.created_by === 'number' && Number.isFinite(data.created_by)
      ? data.created_by
      : 0;
  if (Array.isArray(data.history) && data.history.length > 0) {
    const normalized = data.history.map((entry) => {
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
  await Archive.create(data);
  return doc;
}

export interface SummaryFilters {
  status?: string;
  assignees?: number[];
  from?: Date;
  to?: Date;
}

export async function summary(
  filters: SummaryFilters = {},
): Promise<{ count: number; time: number }> {
  const match: Record<string, unknown> = {};
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

export async function getUsersMap(
  ids: Array<string | number> = [],
): Promise<Record<number, UserDocument>> {
  const numeric = ids.map((id) => Number(id)).filter((id) => !Number.isNaN(id));
  const list = await User.find({ telegram_id: { $in: numeric } });
  const map: Record<number, UserDocument> = {};
  list.forEach((u) => {
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
  return roles.map((r) => ({ ...r, access: accessByRole(r.name || '') }));
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
};
