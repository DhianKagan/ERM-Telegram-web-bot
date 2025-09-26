// Назначение файла: объединение данных CollectionItem с устаревшими коллекциями.
// Основные модули: mongoose, модели CollectionItem, Department, Employee.
import { Types, type FilterQuery } from 'mongoose';
import { CollectionItem } from '../db/models/CollectionItem';
import { Department } from '../db/models/department';
import { Employee } from '../db/models/employee';
import type { CollectionFilters } from '../db/repos/collectionRepo';

export interface AggregatedCollectionItem {
  _id: string;
  type: string;
  name: string;
  value: string;
  meta?: Record<string, unknown>;
}

const SUPPORTED_LEGACY_TYPES = new Set(['departments', 'employees']);

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

const normalizeMeta = (meta?: Record<string, unknown>): Record<string, unknown> | undefined =>
  meta ? { ...meta } : undefined;

const toObjectId = (value: unknown): Types.ObjectId | undefined => {
  if (!value) return undefined;
  if (value instanceof Types.ObjectId) return value;
  if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
    return new Types.ObjectId(value);
  }
  return undefined;
};

const getObjectIdHex = (value: unknown): string | undefined => {
  const objectId = toObjectId(value);
  return objectId?.toHexString();
};

const isLegacyDocument = (id: unknown, cutoff?: string): boolean => {
  if (!cutoff) return true;
  const objectIdHex = getObjectIdHex(id);
  return objectIdHex === undefined || objectIdHex <= cutoff;
};

const mapCollectionItem = (doc: LeanCollectionItem): AggregatedCollectionItem => ({
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
    readonlyReason: 'Элемент перенесён из коллекции Department и доступен только для чтения.',
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
    readonlyReason: 'Сотрудник хранится в коллекции Employee и доступен только для чтения.',
    sourceId: toStringId(doc._id),
    departmentId: doc.departmentId ? toStringId(doc.departmentId) : undefined,
    divisionId: doc.divisionId ? toStringId(doc.divisionId) : undefined,
    positionId: doc.positionId ? toStringId(doc.positionId) : undefined,
  },
});

const shouldIncludeLegacyType = (type?: string): boolean =>
  !type || SUPPORTED_LEGACY_TYPES.has(type);

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
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20;
  const start = (safePage - 1) * safeLimit;
  const end = start + safeLimit;
  return items.slice(start, end);
};

const resolveLegacyCutoffs = async (
  typeFilter?: string,
): Promise<Map<string, string>> => {
  const typesToCheck = typeFilter && SUPPORTED_LEGACY_TYPES.has(typeFilter)
    ? [typeFilter]
    : Array.from(SUPPORTED_LEGACY_TYPES);

  const entries = await Promise.all(
    typesToCheck.map(async (type) => {
      const doc = await CollectionItem.findOne({ type })
        .sort({ _id: 1 })
        .select({ _id: 1 })
        .lean();
      const cutoff = doc ? getObjectIdHex(doc._id) : undefined;
      return cutoff !== undefined ? ([type, cutoff] as const) : undefined;
    }),
  );

  return new Map(entries.filter(Boolean) as [string, string][]);
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

  const baseItemsRaw = (await CollectionItem.find(baseQuery).lean()) as LeanCollectionItem[];
  const items = baseItemsRaw.map(mapCollectionItem);

  const typeFilter = filters.type;
  const legacyCutoffs = shouldIncludeLegacyType(typeFilter)
    ? await resolveLegacyCutoffs(typeFilter)
    : new Map<string, string>();
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

  if (shouldIncludeLegacyType(typeFilter)) {
    if (!typeFilter || typeFilter === 'departments') {
      const departmentsRaw = (await Department.find().lean()) as LeanDepartment[];
      const existingNames = byTypeName.get('departments') ?? new Set<string>();
      const existingIds = byTypeId.get('departments') ?? new Set<string>();
      const cutoff = legacyCutoffs.get('departments');
      departmentsRaw.forEach((dept) => {
        const name = dept.name;
        const id = toStringId(dept._id);
        if (existingNames.has(name) || existingIds.has(id)) return;
        if (!isLegacyDocument(dept._id, cutoff)) return;
        items.push(mapDepartment(dept));
        existingNames.add(name);
        existingIds.add(id);
      });
    }
    if (!typeFilter || typeFilter === 'employees') {
      const employeesRaw = (await Employee.find().lean()) as LeanEmployee[];
      const existingNames = byTypeName.get('employees') ?? new Set<string>();
      const existingIds = byTypeId.get('employees') ?? new Set<string>();
      const cutoff = legacyCutoffs.get('employees');
      employeesRaw.forEach((emp) => {
        const name = emp.name;
        const id = toStringId(emp._id);
        if (existingNames.has(name) || existingIds.has(id)) return;
        if (!isLegacyDocument(emp._id, cutoff)) return;
        items.push(mapEmployee(emp));
        existingNames.add(name);
        existingIds.add(id);
      });
    }
  }

  const filtered = items
    .filter((item) => matchesFilters(item, filters))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const paginated = paginate(filtered, page, limit);

  return { items: paginated, total: filtered.length };
}

export default { listCollectionsWithLegacy };
