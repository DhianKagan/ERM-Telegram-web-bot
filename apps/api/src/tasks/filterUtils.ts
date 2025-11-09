/**
 * Назначение: утилиты нормализации фильтров задач API.
 * Основные модули: обработка списков строк и идентификаторов, подготовка фильтров задач.
 */

export type StringListInput =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly StringListInput[]
  | StringListInput[];

export interface TaskFilterInput {
  readonly status?: StringListInput;
  readonly taskType?: StringListInput;
  readonly assignees?: StringListInput;
  readonly assignee?: StringListInput;
  readonly from?: string | null;
  readonly to?: string | null;
  readonly kanban?: unknown;
  readonly kind?: string | null;
}

export interface NormalizedTaskFilters {
  status?: string | string[];
  taskType?: string | string[];
  assignees?: number[];
  from?: string;
  to?: string;
  kanban?: boolean;
  kind?: string;
}

export interface NormalizeTaskFiltersResult {
  normalized: NormalizedTaskFilters;
  statusValues: string[];
  taskTypeValues: string[];
  assigneeValues: number[];
  kindFilter?: string;
}

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'y']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'n']);

const addUnique = <T>(collection: T[], seen: Set<T>, value: T): void => {
  if (!seen.has(value)) {
    seen.add(value);
    collection.push(value);
  }
};

const toNormalizedString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return `${value}`;
  }

  return undefined;
};

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return undefined;
    }

    return value !== 0;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();

    if (trimmed.length === 0) {
      return undefined;
    }

    if (TRUE_VALUES.has(trimmed)) {
      return true;
    }

    if (FALSE_VALUES.has(trimmed)) {
      return false;
    }

    const numeric = Number.parseFloat(trimmed);

    if (!Number.isNaN(numeric)) {
      return numeric !== 0;
    }
  }

  return undefined;
};

const collectStrings = (input: StringListInput, result: string[], seen: Set<string>): void => {
  if (Array.isArray(input)) {
    for (const item of input) {
      collectStrings(item, result, seen);
    }
    return;
  }

  if (input && typeof input === 'object') {
    return;
  }

  const value = toNormalizedString(input);

  if (value === undefined) {
    return;
  }

  for (const part of value.split(',')) {
    const normalizedPart = part.trim();

    if (normalizedPart.length === 0) {
      continue;
    }

    addUnique(result, seen, normalizedPart);
  }
};

export const parseStringList = (value: StringListInput): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  if (value !== undefined && value !== null) {
    collectStrings(value, result, seen);
  }

  return result;
};

export const parseAssigneeList = (value: StringListInput): number[] => {
  const seen = new Set<number>();
  const result: number[] = [];

  if (value === undefined || value === null) {
    return result;
  }

  const candidates = parseStringList(value);

  for (const candidate of candidates) {
    const parsed = Number.parseInt(candidate, 10);

    if (Number.isNaN(parsed)) {
      continue;
    }

    addUnique(result, seen, parsed);
  }

  return result;
};

export const normalizeTaskFilters = (
  filters: TaskFilterInput,
): NormalizeTaskFiltersResult => {
  const statusValues = filters.status !== undefined ? parseStringList(filters.status) : [];
  const taskTypeValues = filters.taskType !== undefined ? parseStringList(filters.taskType) : [];

  const assigneeValues: number[] = [];
  const assigneeSeen = new Set<number>();

  const initialAssignees = filters.assignees !== undefined ? parseAssigneeList(filters.assignees) : [];
  for (const assignee of initialAssignees) {
    addUnique(assigneeValues, assigneeSeen, assignee);
  }

  const extraAssignees = filters.assignee !== undefined ? parseAssigneeList(filters.assignee) : [];
  for (const assignee of extraAssignees) {
    addUnique(assigneeValues, assigneeSeen, assignee);
  }

  const normalized: NormalizedTaskFilters = {};

  if (statusValues.length > 1) {
    normalized.status = statusValues;
  } else if (statusValues.length === 1) {
    [normalized.status] = statusValues;
  }

  if (taskTypeValues.length > 1) {
    normalized.taskType = taskTypeValues;
  } else if (taskTypeValues.length === 1) {
    [normalized.taskType] = taskTypeValues;
  }

  if (assigneeValues.length > 0) {
    normalized.assignees = assigneeValues;
  }

  const fromValue = toNormalizedString(filters.from ?? undefined);
  if (fromValue !== undefined) {
    normalized.from = fromValue;
  }

  const toValue = toNormalizedString(filters.to ?? undefined);
  if (toValue !== undefined) {
    normalized.to = toValue;
  }

  const kanbanValue = parseBoolean(filters.kanban);
  if (kanbanValue !== undefined) {
    normalized.kanban = kanbanValue;
  }

  const kindValue = typeof filters.kind === 'string' ? filters.kind.trim() : undefined;
  if (kindValue) {
    normalized.kind = kindValue;
  }

  return {
    normalized,
    statusValues,
    taskTypeValues,
    assigneeValues,
    kindFilter: normalized.kind,
  };
};
