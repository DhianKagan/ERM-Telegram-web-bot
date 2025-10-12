// Назначение файла: контроллер состояния задач и их индексов для реактивного UI.
// Основные модули: React, shared, taskColumns, coerceTaskId
import { useSyncExternalStore } from "react";
import type { Task } from "shared";
import type { TaskRow } from "../columns/taskColumns";
import coerceTaskId from "../utils/coerceTaskId";

type Listener = () => void;

type TaskInput =
  | (Partial<TaskRow> & Partial<Task> & { _id?: string | number | null; id?: string | number | null })
  | null
  | undefined;

export interface TaskIndexMeta {
  key: string;
  kind?: "task" | "request";
  mine?: boolean;
  userId?: number;
  pageSize?: number;
  total?: number;
  sort?: "asc" | "desc";
  updatedAt: number;
}

const DEFAULT_PAGE_SIZE = 25;

const REQUEST_TYPE_NAME = "Заявка";

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const normalizeAssignees = (value: unknown): number[] => {
  if (Array.isArray(value)) {
    return value
      .map((candidate) => toNumber(candidate))
      .filter((candidate): candidate is number => candidate !== null);
  }
  const candidate = toNumber(value);
  return candidate !== null ? [candidate] : [];
};

const pickStringOrNull = (...candidates: unknown[]): string | null | undefined => {
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      return candidate;
    }
    if (candidate === null) {
      return null;
    }
  }
  return undefined;
};

const resolveKind = (task: Partial<TaskRow> & Partial<Task>): "task" | "request" => {
  if (task.kind === "request") return "request";
  if (task.kind === "task") return "task";
  const typeName = typeof task.task_type === "string" ? task.task_type.trim() : "";
  return typeName === REQUEST_TYPE_NAME ? "request" : "task";
};

const normalizeTask = (input: TaskInput): TaskRow | null => {
  if (!input) return null;
  const idCandidate =
    (input as Record<string, unknown>)._id ??
    (input as Record<string, unknown>).id ??
    (input as Record<string, unknown>).task_id ??
    (input as Record<string, unknown>).taskId ??
    null;
  const id = coerceTaskId(idCandidate) ??
    (typeof idCandidate === "string" ? idCandidate.trim() : null);
  if (!id) return null;
  const statusRaw =
    typeof input.status === "string" && input.status.trim() ? input.status.trim() : "Новая";
  const createdAt =
    typeof (input as Record<string, unknown>).createdAt === "string"
      ? (input as Record<string, unknown>).createdAt
      : typeof (input as Record<string, unknown>).created_at === "string"
        ? ((input as Record<string, unknown>).created_at as string)
        : undefined;
  const nextDueDate = pickStringOrNull(
    (input as Record<string, unknown>).dueDate,
    (input as Record<string, unknown>).due_date,
  );
  const previousDueDate = pickStringOrNull(
    (input as TaskRow).dueDate,
    (input as TaskRow).due_date,
  );
  const resolvedDueDate =
    nextDueDate !== undefined ? nextDueDate : previousDueDate;
  const assignees = normalizeAssignees(
    (input as Record<string, unknown>).assignees ??
      (input as Record<string, unknown>).assigned_user_id ??
      (input as Record<string, unknown>).assignedUserId,
  );
  const creator =
    (input as Record<string, unknown>).created_by ??
    (input as Record<string, unknown>).createdBy ??
    (input as Record<string, unknown>).creator;
  const normalized: TaskRow = {
    ...(input as TaskRow),
    _id: id,
    id,
    status: statusRaw as TaskRow["status"],
    assignees,
    createdAt: createdAt ?? (input as TaskRow).createdAt,
    dueDate: resolvedDueDate,
    due_date: resolvedDueDate,
    created_by: creator as number | string | null | undefined,
    kind: resolveKind(input as Partial<TaskRow> & Partial<Task>),
  };
  return normalized;
};

const matchesIndex = (meta: TaskIndexMeta | undefined, task: TaskRow): boolean => {
  if (!meta) return true;
  if (meta.kind && resolveKind(task) !== meta.kind) {
    return false;
  }
  if (meta.mine && meta.userId) {
    const author = toNumber(
      (task as Record<string, unknown>).created_by ??
        (task as Record<string, unknown>).creator ??
        (task as Record<string, unknown>).createdBy,
    );
    const assigned = normalizeAssignees(
      (task as Record<string, unknown>).assignees ??
        (task as Record<string, unknown>).assigned_user_id ??
        (task as Record<string, unknown>).assignedUserId,
    );
    const hasAssignment = assigned.includes(meta.userId);
    if (!hasAssignment && author !== meta.userId) {
      return false;
    }
  }
  return true;
};

const applyLimit = (ids: string[], meta: TaskIndexMeta | undefined): string[] => {
  if (!meta) return ids;
  const limit = meta.pageSize && meta.pageSize > 0 ? meta.pageSize : 0;
  if (!limit) return ids;
  return ids.slice(0, limit);
};

const EMPTY_SNAPSHOT = Object.freeze([]) as unknown as TaskRow[];

export class TaskStateController {
  private tasks = new Map<string, TaskRow>();
  private indexes = new Map<string, string[]>();
  private meta = new Map<string, TaskIndexMeta>();
  private snapshots = new Map<string, TaskRow[]>();
  private listeners = new Set<Listener>();
  private version = 0;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }

  clear() {
    if (!this.tasks.size && !this.indexes.size && !this.meta.size) return;
    this.tasks.clear();
    this.indexes.clear();
    this.meta.clear();
    this.snapshots.clear();
    this.notify();
  }

  private rebuildSnapshot(key: string) {
    const ids = this.indexes.get(key);
    if (!ids || !ids.length) {
      this.snapshots.set(key, EMPTY_SNAPSHOT);
      return;
    }
    const rows = ids
      .map((candidate) => this.tasks.get(candidate))
      .filter((task): task is TaskRow => Boolean(task))
      .map((task) => Object.freeze({ ...task })) as TaskRow[];
    this.snapshots.set(key, Object.freeze(rows) as TaskRow[]);
  }

  private rebuildSnapshots(keys: Iterable<string>) {
    for (const key of keys) {
      this.rebuildSnapshot(key);
    }
  }

  setIndex(key: string, list: TaskInput[], meta?: Partial<Omit<TaskIndexMeta, "key" | "updatedAt">>) {
    const ids: string[] = [];
    list.forEach((item) => {
      const normalized = normalizeTask(item);
      if (!normalized) return;
      const existing = this.tasks.get(normalized.id);
      const next = existing ? { ...existing, ...normalized } : normalized;
      this.tasks.set(normalized.id, next);
      ids.push(normalized.id);
    });
    this.indexes.set(key, ids);
    const pageSize = meta?.pageSize ?? (ids.length ? ids.length : DEFAULT_PAGE_SIZE);
    const kind = meta?.kind;
    const mine = meta?.mine;
    const userId = meta?.userId;
    const sort = meta?.sort ?? "desc";
    const total = meta?.total ?? ids.length;
    this.meta.set(key, {
      key,
      pageSize,
      kind,
      mine,
      userId,
      sort,
      total,
      updatedAt: Date.now(),
    });
    this.rebuildSnapshot(key);
    this.notify();
  }

  upsert(task: TaskInput) {
    const normalized = normalizeTask(task);
    if (!normalized) return;
    const existing = this.tasks.get(normalized.id);
    const next = existing ? { ...existing, ...normalized } : normalized;
    this.tasks.set(normalized.id, next);
    let changed = !existing;
    const touched = new Set<string>();
    this.indexes.forEach((ids, key) => {
      const meta = this.meta.get(key);
      const has = ids.includes(normalized.id);
      const matches = matchesIndex(meta, next);
      if (matches && !has) {
        const sorted = meta?.sort === "asc" ? [...ids, normalized.id] : [normalized.id, ...ids];
        const limited = applyLimit(sorted, meta);
        this.indexes.set(key, limited);
        if (meta) {
          this.meta.set(key, {
            ...meta,
            total: (meta.total ?? ids.length) + 1,
            updatedAt: Date.now(),
          });
        }
        changed = true;
      } else if (matches && has) {
        this.indexes.set(key, ids);
      } else if (!matches && has) {
        const filtered = ids.filter((id) => id !== normalized.id);
        this.indexes.set(key, filtered);
        if (meta) {
          this.meta.set(key, {
            ...meta,
            total: Math.max(0, (meta.total ?? filtered.length + 1) - 1),
            updatedAt: Date.now(),
          });
        }
        changed = true;
      }
      if (has || matches) {
        touched.add(key);
      }
    });
    this.rebuildSnapshots(touched);
    if (changed) {
      this.notify();
    } else {
      // обновляем слушателей при изменении содержимого задачи
      this.notify();
    }
  }

  remove(id: string | number | null | undefined) {
    const normalizedId = coerceTaskId(id) ??
      (typeof id === "string" ? id.trim() : null);
    if (!normalizedId) return;
    const existed = this.tasks.delete(normalizedId);
    let changed = existed;
    const touched = new Set<string>();
    this.indexes.forEach((ids, key) => {
      if (!ids.includes(normalizedId)) return;
      const filtered = ids.filter((candidate) => candidate !== normalizedId);
      this.indexes.set(key, filtered);
      const meta = this.meta.get(key);
      if (meta) {
        this.meta.set(key, {
          ...meta,
          total: Math.max(0, (meta.total ?? filtered.length + 1) - 1),
          updatedAt: Date.now(),
        });
      }
      changed = true;
      touched.add(key);
    });
    this.rebuildSnapshots(touched);
    if (changed) {
      this.notify();
    }
  }

  getIndexSnapshot(key: string): TaskRow[] {
    return this.snapshots.get(key) ?? EMPTY_SNAPSHOT;
  }

  getIndexMetaSnapshot(key: string): TaskIndexMeta {
    const meta = this.meta.get(key);
    if (!meta) {
      return {
        key,
        pageSize: DEFAULT_PAGE_SIZE,
        total: 0,
        sort: "desc",
        updatedAt: 0,
      };
    }
    return { ...meta };
  }
}

export const taskStateController = new TaskStateController();

export const useTaskIndex = (key: string) =>
  useSyncExternalStore(
    (listener) => taskStateController.subscribe(listener),
    () => taskStateController.getIndexSnapshot(key),
    () => taskStateController.getIndexSnapshot(key),
  );

export const useTaskIndexMeta = (key: string) =>
  useSyncExternalStore(
    (listener) => taskStateController.subscribe(listener),
    () => taskStateController.getIndexMetaSnapshot(key),
    () => taskStateController.getIndexMetaSnapshot(key),
  );
