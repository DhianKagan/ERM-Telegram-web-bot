// Назначение файла: объединение данных CollectionItem с устаревшими коллекциями.
// Основные модули: mongoose, модели CollectionItem, Department, Employee.
import { type FilterQuery } from 'mongoose';
import { taskFields, TASK_TYPES } from 'shared';
import { CollectionItem } from '../db/models/CollectionItem';
import { Department } from '../db/models/department';
import { Employee } from '../db/models/employee';
import type { CollectionFilters } from '../db/repos/collectionRepo';
import { parseTelegramTopicUrl } from '../utils/telegramTopics';

export interface AggregatedCollectionItem {
  _id: string;
  type: string;
  name: string;
  value: string;
  meta?: Record<string, unknown>;
}

const SUPPORTED_LEGACY_TYPES = new Set(['departments', 'employees']);
const TASK_TYPE_ORDER = new Map<string, number>(
  TASK_TYPES.map((value, index) => [value, index]),
);

type LeanCollectionItem = {
  _id: unknown;
  type: string;
  name: string;
  value: string;
  meta?: Record<string, unknown>;
};

type LeanDepartment = {
  _id: unknown;
  name: string;
  fleetId?: unknown;
};

type LeanEmployee = {
  _id: unknown;
  name: string;
  departmentId?: unknown;
  divisionId?: unknown;
  positionId?: unknown;
};

const toStringId = (value: unknown): string => String(value);

const normalizeMeta = (
  meta?: Record<string, unknown>,
): Record<string, unknown> | undefined => (meta ? { ...meta } : undefined);

const mapCollectionItem = (
  doc: LeanCollectionItem,
): AggregatedCollectionItem => ({
  _id: toStringId(doc._id),
  type: doc.type,
  name: doc.name,
  value: doc.value,
  meta: normalizeMeta(doc.meta),
});

const mapDepartment = (doc: LeanDepartment): AggregatedCollectionItem => ({
  _id: toStringId(doc._id),
  type: 'departments',
  name: doc.name,
  value: '',
  meta: {
    legacy: true,
    readonly: true,
    source: 'departments',
    readonlyReason:
      'Элемент перенесён из коллекции Department и доступен только для чтения.',
    sourceId: toStringId(doc._id),
    fleetId: doc.fleetId ? toStringId(doc.fleetId) : undefined,
  },
});

const mapEmployee = (doc: LeanEmployee): AggregatedCollectionItem => ({
  _id: toStringId(doc._id),
  type: 'employees',
  name: doc.name,
  value: '',
  meta: {
    legacy: true,
    readonly: true,
    source: 'employees',
    readonlyReason:
      'Сотрудник хранится в коллекции Employee и доступен только для чтения.',
    sourceId: toStringId(doc._id),
    departmentId: doc.departmentId ? toStringId(doc.departmentId) : undefined,
    divisionId: doc.divisionId ? toStringId(doc.divisionId) : undefined,
    positionId: doc.positionId ? toStringId(doc.positionId) : undefined,
  },
});

const shouldIncludeLegacyType = (type?: string): boolean =>
  !type || SUPPORTED_LEGACY_TYPES.has(type);

const applyTaskFieldDefaults = (
  item: AggregatedCollectionItem,
  order: number,
  defaults: (typeof taskFields)[number],
) => {
  const meta = item.meta ?? {};
  item.meta = {
    ...meta,
    order,
    defaultLabel: defaults.label,
    fieldType: defaults.type,
    required: Boolean(defaults.required),
    virtual: Boolean(meta.virtual),
  };
  if (!item.value) {
    item.value = defaults.label;
  }
};

const applyTaskTypeDefaults = (
  item: AggregatedCollectionItem,
  order: number,
) => {
  const meta = item.meta ?? {};
  const url =
    typeof meta.tg_theme_url === 'string' ? meta.tg_theme_url.trim() : '';
  const parsed = url ? parseTelegramTopicUrl(url) : null;
  const photosUrl =
    typeof meta.tg_photos_url === 'string' ? meta.tg_photos_url.trim() : '';
  const photosParsed = photosUrl ? parseTelegramTopicUrl(photosUrl) : null;
  item.meta = {
    ...meta,
    order,
    defaultLabel: item.name,
    tg_theme_url: url || undefined,
    tg_chat_id: parsed?.chatId,
    tg_topic_id: parsed?.topicId,
    tg_photos_url: photosUrl || undefined,
    tg_photos_chat_id: photosParsed?.chatId,
    tg_photos_topic_id: photosParsed?.topicId,
    virtual: Boolean(meta.virtual),
  };
  if (!item.value) {
    item.value = item.name;
  }
};

const ensureTaskFieldItems = (items: AggregatedCollectionItem[]) => {
  const existing = new Map<string, AggregatedCollectionItem>();
  items
    .filter((item) => item.type === 'task_fields')
    .forEach((item) => {
      existing.set(item.name, item);
    });
  taskFields.forEach((field, index) => {
    const target = existing.get(field.name);
    if (target) {
      applyTaskFieldDefaults(target, index, field);
      return;
    }
    const virtual: AggregatedCollectionItem = {
      _id: `virtual:task_field:${field.name}`,
      type: 'task_fields',
      name: field.name,
      value: field.label,
      meta: {
        order: index,
        defaultLabel: field.label,
        fieldType: field.type,
        required: Boolean(field.required),
        virtual: true,
      },
    };
    items.push(virtual);
  });
};

const ensureTaskTypeItems = (items: AggregatedCollectionItem[]) => {
  const existing = new Map<string, AggregatedCollectionItem>();
  items
    .filter((item) => item.type === 'task_types')
    .forEach((item) => {
      existing.set(item.name, item);
    });
  TASK_TYPES.forEach((typeName, index) => {
    const target = existing.get(typeName);
    if (target) {
      applyTaskTypeDefaults(target, index);
      return;
    }
    const virtual: AggregatedCollectionItem = {
      _id: `virtual:task_type:${typeName}`,
      type: 'task_types',
      name: typeName,
      value: typeName,
      meta: {
        order: index,
        defaultLabel: typeName,
        tg_theme_url: undefined,
        tg_chat_id: undefined,
        tg_topic_id: undefined,
        tg_photos_url: undefined,
        tg_photos_chat_id: undefined,
        tg_photos_topic_id: undefined,
        virtual: true,
      },
    };
    items.push(virtual);
  });
  items
    .filter((item) => item.type === 'task_types')
    .forEach((item) => {
      const order = TASK_TYPE_ORDER.get(item.name) ?? TASK_TYPES.length;
      applyTaskTypeDefaults(item, order);
    });
};

const compareByOrder = (a?: unknown, b?: unknown): number => {
  const left = typeof a === 'number' ? a : Number.POSITIVE_INFINITY;
  const right = typeof b === 'number' ? b : Number.POSITIVE_INFINITY;
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
};

const matchesFilters = (
  item: AggregatedCollectionItem,
  filters: CollectionFilters,
): boolean => {
  if (filters.type && item.type !== filters.type) return false;
  if (filters.name && item.name !== filters.name) return false;
  if (filters.value && item.value !== filters.value) return false;
  if (filters.search) {
    const term = filters.search.trim().toLowerCase();
    const haystack = `${item.name} ${item.value}`.toLowerCase();
    if (!haystack.includes(term)) return false;
  }
  return true;
};

const paginate = <T>(items: T[], page: number, limit: number): T[] => {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit =
    Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20;
  const start = (safePage - 1) * safeLimit;
  const end = start + safeLimit;
  return items.slice(start, end);
};

export async function listCollectionsWithLegacy(
  filters: CollectionFilters = {},
  page = 1,
  limit = 20,
): Promise<{ items: AggregatedCollectionItem[]; total: number }> {
  const baseQuery: FilterQuery<LeanCollectionItem> = {};
  if (filters.type) baseQuery.type = filters.type;
  if (filters.name) baseQuery.name = filters.name;
  if (filters.value) baseQuery.value = filters.value;

  const baseItemsRaw = (await CollectionItem.find(
    baseQuery,
  ).lean()) as LeanCollectionItem[];
  const items = baseItemsRaw.map(mapCollectionItem);

  const typeFilter = filters.type;
  const byTypeName = new Map<string, Set<string>>();
  const byTypeId = new Map<string, Set<string>>();
  items.forEach((item) => {
    if (!byTypeName.has(item.type)) {
      byTypeName.set(item.type, new Set());
    }
    if (!byTypeId.has(item.type)) {
      byTypeId.set(item.type, new Set());
    }
    byTypeName.get(item.type)?.add(item.name);
    byTypeId.get(item.type)?.add(item._id);
  });

  if (!typeFilter || typeFilter === 'task_fields') {
    ensureTaskFieldItems(items);
  }
  if (!typeFilter || typeFilter === 'task_types') {
    ensureTaskTypeItems(items);
  }

  if (shouldIncludeLegacyType(typeFilter)) {
    if (!typeFilter || typeFilter === 'departments') {
      const departmentsRaw =
        (await Department.find().lean()) as LeanDepartment[];
      const existingNames = byTypeName.get('departments') ?? new Set<string>();
      const existingIds = byTypeId.get('departments') ?? new Set<string>();
      departmentsRaw.forEach((dept) => {
        const name = dept.name;
        const id = toStringId(dept._id);
        if (existingNames.has(name) || existingIds.has(id)) return;
        items.push(mapDepartment(dept));
        existingNames.add(name);
        existingIds.add(id);
      });
    }
    if (!typeFilter || typeFilter === 'employees') {
      const employeesRaw = (await Employee.find().lean()) as LeanEmployee[];
      const existingNames = byTypeName.get('employees') ?? new Set<string>();
      const existingIds = byTypeId.get('employees') ?? new Set<string>();
      employeesRaw.forEach((emp) => {
        const name = emp.name;
        const id = toStringId(emp._id);
        if (existingNames.has(name) || existingIds.has(id)) return;
        items.push(mapEmployee(emp));
        existingNames.add(name);
        existingIds.add(id);
      });
    }
  }

  const filtered = items
    .filter((item) => matchesFilters(item, filters))
    .sort((a, b) => {
      if (a.type === 'task_fields' && b.type === 'task_fields') {
        return compareByOrder(a.meta?.order, b.meta?.order);
      }
      if (a.type === 'task_types' && b.type === 'task_types') {
        return compareByOrder(a.meta?.order, b.meta?.order);
      }
      return a.name.localeCompare(b.name, 'ru');
    });
  const paginated = paginate(filtered, page, limit);

  return { items: paginated, total: filtered.length };
}

export default { listCollectionsWithLegacy };
