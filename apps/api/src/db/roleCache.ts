// Назначение: кеширует ObjectId ролей по имени для ускорения запросов
// Основные модули: mongoose Types, Role модель
import { Types } from 'mongoose';
import { Role } from './model';

type CacheValue = Types.ObjectId | null;

const resolvedRoles = new Map<string, CacheValue>();
const pendingLookups = new Map<string, Promise<CacheValue>>();

function normalizeRoleName(name: string): string {
  return (name || '').trim().toLowerCase();
}

async function loadRoleId(name: string): Promise<CacheValue> {
  const role = await Role.findOne({ name }).select({ _id: 1 });
  return role ? (role._id as Types.ObjectId) : null;
}

export async function resolveRoleId(
  name: string,
): Promise<Types.ObjectId | null> {
  const normalized = normalizeRoleName(name);
  if (!normalized) return null;

  if (resolvedRoles.has(normalized)) {
    return resolvedRoles.get(normalized) ?? null;
  }

  let lookup = pendingLookups.get(normalized);
  if (!lookup) {
    lookup = loadRoleId(normalized).then((value) => {
      pendingLookups.delete(normalized);
      resolvedRoles.set(normalized, value);
      return value;
    });
    pendingLookups.set(normalized, lookup);
  }

  return lookup;
}

export function clearRoleCache(name?: string): void {
  if (name) {
    const normalized = normalizeRoleName(name);
    if (!normalized) return;
    resolvedRoles.delete(normalized);
    pendingLookups.delete(normalized);
    return;
  }
  resolvedRoles.clear();
  pendingLookups.clear();
}
