// Централизованные функции работы с MongoDB для всего проекта
// Основные модули: mongoose модели, wgLogEngine, config
import {
  Task,
  Archive,
  User,
  Role,
  TaskDocument,
  UserDocument,
  RoleDocument,
} from './model';
import * as logEngine from '../services/wgLogEngine';
import config from '../config';
import { Types, PipelineStage, Query } from 'mongoose';

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

export async function createTask(
  data: Partial<TaskDocument>,
): Promise<TaskDocument> {
  return Task.create(data);
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
): Promise<TaskDocument | null> {
  const data = sanitizeUpdate(fields);
  return Task.findByIdAndUpdate(id, data, { new: true });
}

export async function updateTaskStatus(
  id: string,
  status: string,
): Promise<TaskDocument | null> {
  return updateTask(id, { status } as Partial<TaskDocument>);
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
): Promise<TaskDocument[]> {
  const isQuery = (v: unknown): v is Query<TaskDocument[], TaskDocument> =>
    typeof v === 'object' && v !== null && 'exec' in v;
  if (filters.kanban) {
    const res = Task.find({}) as unknown;
    if (isQuery(res)) {
      return res.sort('-createdAt').lean().exec();
    }
    return res as TaskDocument[];
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
    if (limit) {
      const p = Number(page) || 1;
      const l = Number(limit) || 20;
      query = query.skip((p - 1) * l).limit(l);
    }
    return query.lean().exec();
  }
  return res as TaskDocument[];
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
): Promise<TaskDocument | null> {
  const task = await Task.findById(id);
  if (!task) return null;
  task.time_spent = (task.time_spent || 0) + minutes;
  await task.save();
  return task;
}

export async function bulkUpdate(
  ids: string[],
  data: Partial<TaskDocument>,
): Promise<void> {
  await Task.updateMany({ _id: { $in: ids } }, data);
}

export async function deleteTask(id: string): Promise<TaskDocument | null> {
  const doc = await Task.findByIdAndDelete(id);
  if (!doc) return null;
  const data = doc.toObject();
  (data as unknown as Record<string, unknown>).request_id = `${
    (data as unknown as Record<string, unknown>).request_id
  }-DEL`;
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

export async function createUser(
  id: string | number,
  username?: string,
  roleId?: string,
  extra: Partial<UserDocument> = {},
): Promise<UserDocument> {
  const telegramId = Number(id);
  if (Number.isNaN(telegramId)) throw new Error('Invalid telegram_id');
  const email = `${telegramId}@telegram.local`;
  let role = 'user';
  let rId = roleId || config.userRoleId;
  if (rId) {
    if (!Types.ObjectId.isValid(rId)) {
      throw new Error('Invalid roleId');
    }
    const dbRole = await Role.findById(rId);
    if (dbRole) {
      role = dbRole.name || 'user';
      rId = (dbRole._id as Types.ObjectId).toString();
    }
  }
  return User.create({
    telegram_id: telegramId,
    username,
    email,
    name: username,
    role,
    roleId: rId as unknown as Types.ObjectId,
    access: extra.access || 1,
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
  data: Partial<UserDocument>,
): Promise<UserDocument | null> {
  const telegramId = Number(id);
  if (Number.isNaN(telegramId)) return null;
  const sanitized = sanitizeUpdate(data);
  return User.findOneAndUpdate(
    { telegram_id: { $eq: telegramId } },
    sanitized,
    { new: true },
  );
}

export async function listRoles(): Promise<RoleDocument[]> {
  return Role.find();
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
  listRoutes,
};
