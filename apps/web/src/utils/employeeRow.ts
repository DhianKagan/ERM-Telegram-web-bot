// Назначение: утилиты нормализации данных сотрудников и построения EmployeeRow
// Основные модули: types/user
import type { EmployeeRow } from '../columns/settingsEmployeeColumns';
import type { User } from '../types/user';

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const normalizeNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const normalizeStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export type EmployeeRowSource = User & {
  roleName?: string | null;
  departmentName?: string | null;
  divisionName?: string | null;
  positionName?: string | null;
};

export const buildEmployeeRow = (source: EmployeeRowSource): EmployeeRow => {
  const row: Partial<EmployeeRow> = {
    roleName: normalizeString(source.roleName) ?? '',
    departmentName: normalizeString(source.departmentName) ?? '',
    divisionName: normalizeString(source.divisionName) ?? '',
    positionName: normalizeString(source.positionName) ?? '',
  };

  const assignString = <K extends keyof EmployeeRow>(key: K, raw: unknown) => {
    const normalized = normalizeString(raw);
    if (normalized !== undefined) {
      row[key] = normalized as EmployeeRow[K];
    }
  };

  const assignNumber = <K extends keyof EmployeeRow>(key: K, raw: unknown) => {
    const normalized = normalizeNumber(raw);
    if (normalized !== undefined) {
      row[key] = normalized as EmployeeRow[K];
    }
  };

  assignString('id', source.id);
  assignNumber('telegram_id', source.telegram_id);
  assignString('telegram_username', source.telegram_username);
  assignString('username', source.username);
  assignString('name', source.name);
  assignString('phone', source.phone);
  assignString('mobNumber', source.mobNumber);
  assignString('email', source.email);
  assignString('role', source.role);
  assignNumber('access', source.access);
  const permissions = normalizeStringArray(source.permissions);
  if (permissions !== undefined) {
    row.permissions = permissions;
  }
  assignString('roleId', source.roleId);
  assignString('roleName', row.roleName);
  assignString('departmentId', source.departmentId);
  assignString('departmentName', row.departmentName);
  assignString('divisionId', source.divisionId);
  assignString('divisionName', row.divisionName);
  assignString('positionId', source.positionId);
  assignString('positionName', row.positionName);

  return row as EmployeeRow;
};
