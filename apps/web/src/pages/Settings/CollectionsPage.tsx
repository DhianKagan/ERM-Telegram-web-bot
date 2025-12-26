// Назначение: страница управления коллекциями настроек
// Основные модули: React, match-sorter, Tabs, services/collections
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { matchSorter, rankings } from 'match-sorter';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { UiCard } from '@/components/ui/UiCard';
import { UiFormGroup } from '@/components/ui/UiFormGroup';
import { UiInput } from '@/components/ui/UiInput';
import { UiSelect } from '@/components/ui/UiSelect';
import { UiRadio } from '@/components/ui/UiRadio';
import { UiTable, type UiTableColumn } from '@/components/ui/UiTable';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../../components/Tabs';
import ActionBar from '../../components/ActionBar';
import Breadcrumbs from '../../components/Breadcrumbs';
import CopyableId from '../../components/CopyableId';
import Spinner from '../../components/Spinner';
import {
  fetchCollectionItems,
  fetchAllCollectionItems,
  createCollectionItem,
  updateCollectionItem,
  removeCollectionItem,
  CollectionItem,
  toCollectionObject,
  fetchCollectionObjects,
  fetchAllCollectionObjects,
  type CollectionObject,
} from '../../services/collections';
import CollectionForm, { CollectionFormState } from './CollectionForm';
import ConfirmDialog from '../../components/ConfirmDialog';
import EmployeeCardForm from '../../components/EmployeeCardForm';
import Modal from '../../components/Modal';
import FleetVehiclesTab from './FleetVehiclesTab';
import TaskSettingsTab from './TaskSettingsTab';
import AnalyticsDashboard from '../AnalyticsDashboard';
import ArchivePage from '../Archive';
import LogsPage from '../Logs';
import StoragePage from '../Storage';
import HealthCheckTab from './HealthCheckTab';
import {
  type CollectionTableRow,
  collectionColumns,
  collectionObjectColumns,
} from '../../columns/collectionColumns';
import { type FixedAssetRow } from '../../columns/fixedAssetColumns';
import { type EmployeeRow } from '../../columns/settingsEmployeeColumns';
import {
  fetchUsers,
  createUser as createUserApi,
  updateUser as updateUserApi,
  deleteUser as deleteUserApi,
  type UserDetails,
} from '../../services/users';
import { fetchRoles, type Role } from '../../services/roles';
import { formatRoleName } from '../../utils/roleDisplay';
import { buildEmployeeRow } from '../../utils/employeeRow';
import UserForm, { UserFormData } from './UserForm';
import type { User } from '../../types/user';
import { useAuth } from '../../context/useAuth';
import {
  SETTINGS_BADGE_CLASS,
  SETTINGS_BADGE_EMPTY,
  SETTINGS_BADGE_WRAPPER_CLASS,
} from './badgeStyles';
import { hasAccess, ACCESS_ADMIN } from '../../utils/access';
import { showToast } from '../../utils/toast';
import {
  BuildingOffice2Icon,
  Squares2X2Icon,
  IdentificationIcon,
  UserGroupIcon,
  TruckIcon,
  KeyIcon,
  ClipboardDocumentListIcon,
  AdjustmentsHorizontalIcon,
  ChartPieIcon,
  ArchiveBoxIcon,
  DocumentTextIcon,
  RectangleStackIcon,
  ShieldCheckIcon,
  MapPinIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

const moduleTabs = [
  {
    key: 'directories',
    label: 'Справочники',
    description: 'Структура компании и доступы',
    icon: AdjustmentsHorizontalIcon,
  },
  {
    key: 'reports',
    label: 'Отчёты',
    description: 'Аналитика процессов и KPI',
    icon: ChartPieIcon,
  },
  {
    key: 'archive',
    label: 'Архив',
    description: 'История задач и записей',
    icon: ArchiveBoxIcon,
  },
  {
    key: 'logs',
    label: 'Логи',
    description: 'Журнал действий и событий',
    icon: DocumentTextIcon,
  },
  {
    key: 'storage',
    label: 'Файлы',
    description: 'Управление вложениями',
    icon: RectangleStackIcon,
  },
  {
    key: 'health',
    label: 'Мониторинг',
    description: 'Проверка прокси, Redis и MongoDB',
    icon: ShieldCheckIcon,
  },
] as const;

type SettingsModuleKey = (typeof moduleTabs)[number]['key'];

const isValidModuleKey = (value: string | null): value is SettingsModuleKey =>
  moduleTabs.some((module) => module.key === value);

const types = [
  {
    key: 'departments',
    label: 'Департамент',
    description: 'Структура компании и направления',
  },
  {
    key: 'divisions',
    label: 'Отдел',
    description: 'Команды внутри департаментов',
  },
  {
    key: 'positions',
    label: 'Должность',
    description: 'Роли и рабочие позиции',
  },
  {
    key: 'objects',
    label: 'Объект',
    description: 'Адреса и координаты площадок',
  },
  {
    key: 'employees',
    label: 'Сотрудник',
    description: 'Карточки и доступы сотрудников',
  },
  {
    key: 'fleets',
    label: 'Автопарк',
    description: 'Транспорт и связанный состав',
  },
  {
    key: 'fixed_assets',
    label: 'Основные средства',
    description: 'Генераторы, станки и оборудование',
  },
  {
    key: 'users',
    label: 'Пользователь',
    description: 'Учётные записи в системе',
  },
  {
    key: 'tasks',
    label: 'Задачи',
    description: 'Поля формы и темы публикаций',
  },
] as const;

type CollectionKey = (typeof types)[number]['key'];

const createInitialQueries = (): Record<CollectionKey, string> =>
  types.reduce(
    (acc, type) => {
      acc[type.key as CollectionKey] = '';
      return acc;
    },
    {} as Record<CollectionKey, string>,
  );

const emptyUser: UserFormData = {
  telegram_id: undefined,
  username: '',
  name: '',
  phone: '',
  mobNumber: '',
  email: '',
  role: 'user',
  access: 1,
  roleId: '',
  departmentId: '',
  divisionId: '',
  positionId: '',
};

const emptyItemForm: ItemForm = {
  name: '',
  value: '',
  meta: undefined,
  address: '',
  latitude: '',
  longitude: '',
};

const tabIcons: Record<
  CollectionKey,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  departments: BuildingOffice2Icon,
  divisions: Squares2X2Icon,
  positions: IdentificationIcon,
  objects: MapPinIcon,
  employees: UserGroupIcon,
  fleets: TruckIcon,
  fixed_assets: WrenchScrewdriverIcon,
  users: KeyIcon,
  tasks: ClipboardDocumentListIcon,
};

const collectionTableColumns: UiTableColumn<CollectionTableRow>[] = [
  { key: 'name', header: 'Название' },
  { key: 'value', header: 'Значение' },
  { key: 'displayValue', header: 'Связанные данные' },
  { key: 'type', header: 'Тип' },
  { key: '_id', header: 'Идентификатор' },
  { key: 'metaSummary', header: 'Доп. сведения' },
];

const collectionObjectTableColumns: UiTableColumn<CollectionTableRow>[] = [
  { key: 'name', header: 'Название' },
  { key: 'address', header: 'Адрес' },
  { key: 'coordinates', header: 'Координаты' },
  { key: '_id', header: 'Идентификатор' },
];

const fixedAssetTableColumns: UiTableColumn<FixedAssetRow>[] = [
  { key: 'name', header: 'Название' },
  { key: 'inventoryNumber', header: 'Инвентарный номер' },
  { key: 'location', header: 'Расположение' },
  { key: 'description', header: 'Описание' },
  { key: '_id', header: 'ID' },
];

const userTableColumns: UiTableColumn<User>[] = [
  { key: 'telegram_id', header: 'Telegram ID' },
  {
    key: 'username',
    header: 'Логин',
    render: (row) => row.telegram_username ?? row.username ?? '',
  },
  { key: 'name', header: 'Имя' },
  { key: 'phone', header: 'Телефон' },
  { key: 'mobNumber', header: 'Моб. номер' },
  { key: 'email', header: 'E-mail' },
  {
    key: 'role',
    header: 'Роль',
    render: (row) => formatRoleName(row.role),
  },
  {
    key: 'access',
    header: 'Доступ',
    render: (row) => (row.access === undefined ? '—' : String(row.access)),
  },
  { key: 'roleId', header: 'Роль ID' },
  { key: 'departmentId', header: 'Департамент' },
  { key: 'divisionId', header: 'Отдел' },
  { key: 'positionId', header: 'Должность' },
];

const employeeTableColumns: UiTableColumn<EmployeeRow>[] = [
  { key: 'telegram_id', header: 'Telegram ID' },
  {
    key: 'username',
    header: 'Логин',
    render: (row) => row.telegram_username ?? row.username ?? '',
  },
  { key: 'name', header: 'Имя' },
  { key: 'phone', header: 'Телефон' },
  { key: 'mobNumber', header: 'Моб. номер' },
  { key: 'email', header: 'E-mail' },
  {
    key: 'role',
    header: 'Роль',
    render: (row) => formatRoleName(row.role),
  },
  {
    key: 'access',
    header: 'Доступ',
    render: (row) => (row.access === undefined ? '—' : String(row.access)),
  },
  {
    key: 'roleId',
    header: 'Роль ID',
    render: (row) => row.roleName || row.roleId || '—',
  },
  {
    key: 'departmentId',
    header: 'Департамент',
    render: (row) => row.departmentName || '—',
  },
  {
    key: 'divisionId',
    header: 'Отдел',
    render: (row) => row.divisionName || '—',
  },
  {
    key: 'positionId',
    header: 'Должность',
    render: (row) => row.positionName || '—',
  },
];

const renderPaginationControls = (
  pageIndex: number,
  totalPagesValue: number,
  onChange: (page: number) => void,
) => (
  <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
    <span className="text-sm text-[color:var(--color-gray-600)] dark:text-[color:var(--color-gray-300)]">
      Страница {pageIndex} из {totalPagesValue || 1}
    </span>
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => onChange(Math.max(1, pageIndex - 1))}
        disabled={pageIndex <= 1}
      >
        Назад
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onChange(Math.min(totalPagesValue || 1, pageIndex + 1))}
        disabled={pageIndex >= totalPagesValue}
      >
        Вперёд
      </Button>
    </div>
  </div>
);

const renderBadgeList = (items: string[]) => {
  if (!items.length) {
    return (
      <span className={SETTINGS_BADGE_CLASS} title={SETTINGS_BADGE_EMPTY}>
        {SETTINGS_BADGE_EMPTY}
      </span>
    );
  }
  return (
    <div className={SETTINGS_BADGE_WRAPPER_CLASS}>
      {items.map((item, index) => (
        <span
          key={`${item}-${index}`}
          className={SETTINGS_BADGE_CLASS}
          title={item}
        >
          {item}
        </span>
      ))}
    </div>
  );
};

type ItemForm = CollectionFormState & { meta?: CollectionItem['meta'] };

const normalizeId = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withoutQuotes = trimmed.replace(/^['"]+|['"]+$/g, '');
  const withoutBrackets = withoutQuotes.replace(/^\[+|\]+$/g, '');
  const withoutBraces = withoutBrackets.replace(/^[{}]+|[{}]+$/g, '');
  const withoutTrailingComma = withoutBraces.replace(/,+$/g, '');
  return withoutTrailingComma.trim();
};

const collectStringIds = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStringIds);
  }
  if (value && typeof value === 'object') {
    const result: string[] = [];
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      if (Array.isArray(entry) || (entry && typeof entry === 'object')) {
        result.push(...collectStringIds(entry));
        return;
      }
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (!trimmed) return;
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('id') || !/\s/.test(trimmed)) {
          result.push(trimmed);
        }
        return;
      }
      if (typeof entry === 'boolean' || typeof entry === 'number') {
        if (entry) {
          result.push(key);
        }
      }
    });
    return result;
  }
  return [];
};

const KEY_LABEL_OVERRIDES: Record<string, string> = {
  telegram_id: 'Telegram ID',
  telegram_username: 'Логин Telegram',
  username: 'Логин',
  name: 'Имя',
  phone: 'Телефон',
  mobNumber: 'Моб. номер',
  email: 'E-mail',
  role: 'Роль',
  access: 'Доступ',
  roleId: 'Роль ID',
  departmentId: 'Департамент',
  departmentName: 'Департамент',
  divisionId: 'Отдел',
  divisionName: 'Отдел',
  positionId: 'Должность',
  positionName: 'Должность',
  permissions: 'Права',
  fleetId: 'Автопарк',
  source: 'Источник',
  sourceId: 'ID источника',
  readonly: 'Только чтение',
  readonlyReason: 'Причина ограничения',
  invalid: 'Некорректен',
  invalidReason: 'Причина ошибки',
  invalidCode: 'Код ошибки',
  invalidAt: 'Ошибка от',
  syncPending: 'Ожидает синхронизации',
  syncWarning: 'Предупреждение',
  syncError: 'Ошибка синхронизации',
  syncFailedAt: 'Сбой синхронизации',
  defaultLabel: 'Название по умолчанию',
  fieldType: 'Тип поля',
  required: 'Обязательное',
  order: 'Порядок',
  virtual: 'Системный элемент',
  tg_theme_url: 'Тема Telegram',
  tg_chat_id: 'ID чата',
  tg_topic_id: 'ID темы',
  tg_photos_url: 'Тема для фото',
  tg_photos_chat_id: 'ID чата фото',
  tg_photos_topic_id: 'ID темы фото',
  inventoryNumber: 'Инвентарный номер',
  description: 'Описание',
  locationSource: 'Источник расположения',
  locationAddress: 'Адрес',
  locationObjectId: 'Объект',
};

const formatKeyLabel = (key: string): string => {
  const override = KEY_LABEL_OVERRIDES[key];
  if (override) return override;
  const normalized = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  if (!normalized) return key;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatSummaryValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') {
    return value ? 'Да' : 'Нет';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed;
  }
  if (Array.isArray(value)) {
    const formatted = value
      .map((item) => formatSummaryValue(item))
      .filter(Boolean);
    return formatted.join(', ');
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => {
        const formatted = formatSummaryValue(nested);
        if (!formatted) return '';
        return `${formatKeyLabel(key)}=${formatted}`;
      })
      .filter(Boolean);
    return entries.join('; ');
  }
  return '';
};

const summarizeRecord = (record?: Record<string, unknown>): string => {
  if (!record) return '';
  const entries = Object.entries(record)
    .map(([key, value]) => {
      const formatted = formatSummaryValue(value);
      if (!formatted) return '';
      return `${formatKeyLabel(key)}: ${formatted}`;
    })
    .filter(Boolean);
  return entries.join('\n');
};

const tryParseJsonValue = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

const formatCollectionRawValue = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const parsed =
    trimmed.startsWith('{') || trimmed.startsWith('[')
      ? tryParseJsonValue(trimmed)
      : undefined;
  if (Array.isArray(parsed)) {
    const formatted = parsed
      .map((item) => formatSummaryValue(item))
      .filter(Boolean);
    if (formatted.length) {
      return formatted.join('\n');
    }
  } else if (parsed && typeof parsed === 'object') {
    const summary = summarizeRecord(parsed as Record<string, unknown>);
    if (summary) {
      return summary;
    }
  }
  if (trimmed.includes(',')) {
    const parts = trimmed
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      return parts.join('\n');
    }
  }
  return trimmed;
};

const IdsSchema = z
  .preprocess((input) => {
    if (input === null || input === undefined) {
      return [];
    }
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) {
        return [];
      }
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return collectStringIds(parsed);
        } catch {
          // игнорируем ошибки парсинга и переходим к разбору по разделителю
        }
      }
      return trimmed
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    }
    if (Array.isArray(input) || (input && typeof input === 'object')) {
      return collectStringIds(input);
    }
    return [String(input)];
  }, z.array(z.string()))
  .transform((values) => {
    const normalized = values
      .map((value) => normalizeId(String(value)))
      .filter((value) => value.length > 0);
    return Array.from(new Set(normalized));
  });

const safeParseIds = (value: unknown): string[] => {
  const result = IdsSchema.safeParse(value);
  return result.success ? result.data : [];
};

const mergeById = <T extends { _id: string }>(
  current: T[],
  incoming: T[],
): T[] => {
  if (!incoming.length) {
    return current;
  }
  const merged = current.slice();
  const indexById = new Map<string, number>();
  merged.forEach((item, index) => {
    indexById.set(item._id, index);
  });
  let changed = false;
  incoming.forEach((item) => {
    const index = indexById.get(item._id);
    if (typeof index === 'number') {
      if (merged[index] !== item) {
        merged[index] = item;
        changed = true;
      }
      return;
    }
    indexById.set(item._id, merged.length);
    merged.push(item);
    changed = true;
  });
  return changed ? merged : current;
};

const resolveReferenceName = (
  map: Map<string, string>,
  id?: string | null,
  fallbackName?: string | null,
): string => {
  const directName =
    typeof fallbackName === 'string' && fallbackName.trim().length
      ? fallbackName.trim()
      : '';
  if (directName) return directName;
  if (typeof id !== 'string') return '';
  const trimmed = id.trim();
  if (!trimmed) return '';
  return map.get(trimmed) ?? trimmed;
};

type EmployeeDetailsIndex = {
  byId: Map<string, Partial<User>>;
  byTelegramUsername: Map<string, Partial<User>>;
  byUsername: Map<string, Partial<User>>;
};

const readValue = (
  source: Record<string, unknown>,
  keys: string[],
): unknown => {
  for (const key of keys) {
    if (key in source) return source[key];
  }
  const lowerCaseSource: Record<string, unknown> = {};
  Object.entries(source).forEach(([key, value]) => {
    lowerCaseSource[key.toLowerCase()] = value;
  });
  for (const key of keys) {
    const lowerKey = key.toLowerCase();
    if (lowerKey in lowerCaseSource) return lowerCaseSource[lowerKey];
  }
  return undefined;
};

const pickString = (
  source: Record<string, unknown>,
  keys: string[],
  fallback?: string,
): string | undefined => {
  const raw = readValue(source, keys);
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.length) return trimmed;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(raw);
  }
  if (typeof fallback === 'string') {
    const trimmed = fallback.trim();
    if (trimmed.length) return trimmed;
  }
  return undefined;
};

const pickNumber = (
  source: Record<string, unknown>,
  keys: string[],
): number | undefined => {
  const raw = readValue(source, keys);
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const pickStringArray = (
  source: Record<string, unknown>,
  keys: string[],
): string[] | undefined => {
  const raw = readValue(source, keys);
  if (!Array.isArray(raw)) return undefined;
  const normalized = raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return normalized.length ? normalized : undefined;
};

const collectEmployeeDetails = (
  item: CollectionItem,
): Partial<User> | undefined => {
  if (item.type !== 'employees') return undefined;
  const parts: Record<string, unknown>[] = [];
  if (item.meta && typeof item.meta === 'object') {
    parts.push(item.meta as Record<string, unknown>);
  }
  const rawValue = item.value;
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          parts.push(parsed as Record<string, unknown>);
        }
      } catch {
        // игнорируем значения, которые не являются JSON
      }
    }
  } else if (
    rawValue &&
    typeof rawValue === 'object' &&
    !Array.isArray(rawValue)
  ) {
    parts.push(rawValue as Record<string, unknown>);
  }

  if (!parts.length) {
    const name = item.name?.trim();
    return name ? { name } : undefined;
  }

  const combined = parts.reduce<Record<string, unknown>>(
    (acc, part) => ({ ...acc, ...part }),
    {},
  );

  const details: Partial<User> = {};
  const telegramId = pickNumber(combined, ['telegram_id', 'telegramId', 'id']);
  if (typeof telegramId === 'number') {
    details.telegram_id = telegramId;
  }
  const telegramUsername = pickString(combined, [
    'telegram_username',
    'telegramUsername',
    'telegram_login',
    'telegramLogin',
  ]);
  if (telegramUsername) {
    details.telegram_username = telegramUsername;
  }
  const username = pickString(combined, ['username', 'login']);
  if (username) {
    details.username = username;
  }
  const name = pickString(combined, ['name', 'fullName'], item.name);
  const firstName = pickString(combined, ['firstName', 'first_name']);
  const lastName = pickString(combined, [
    'lastName',
    'last_name',
    'surname',
    'familyName',
  ]);
  const middleName = pickString(combined, [
    'middleName',
    'middle_name',
    'patronymic',
  ]);
  if (name) {
    details.name = name;
  } else {
    const parts = [lastName, firstName, middleName].filter(
      (part): part is string =>
        typeof part === 'string' && part.trim().length > 0,
    );
    if (parts.length) {
      details.name = parts.join(' ');
    }
  }
  const phone = pickString(combined, ['phone', 'phone_number', 'phoneNumber']);
  if (phone) {
    details.phone = phone;
  }
  const mobNumber = pickString(combined, [
    'mobNumber',
    'mobile',
    'mobile_phone',
    'mobilePhone',
  ]);
  if (mobNumber) {
    details.mobNumber = mobNumber;
  }
  const email = pickString(combined, ['email', 'mail']);
  if (email) {
    details.email = email;
  }
  const role = pickString(combined, ['role', 'roleName']);
  if (role) {
    details.role = role;
  }
  const access = pickNumber(combined, [
    'access',
    'access_level',
    'accessLevel',
  ]);
  if (typeof access === 'number') {
    details.access = access;
  }
  const roleId = pickString(combined, ['roleId', 'role_id']);
  if (roleId) {
    details.roleId = roleId;
  }
  const roleName = pickString(combined, ['roleName']);
  if (roleName) {
    details.roleName = roleName;
  }
  const departmentId = pickString(combined, ['departmentId', 'department_id']);
  if (departmentId) {
    details.departmentId = departmentId;
  }
  const departmentName = pickString(combined, ['departmentName']);
  if (departmentName) {
    details.departmentName = departmentName;
  }
  const divisionId = pickString(combined, ['divisionId', 'division_id']);
  if (divisionId) {
    details.divisionId = divisionId;
  }
  const divisionName = pickString(combined, ['divisionName']);
  if (divisionName) {
    details.divisionName = divisionName;
  }
  const positionId = pickString(combined, ['positionId', 'position_id']);
  if (positionId) {
    details.positionId = positionId;
  }
  const positionName = pickString(combined, ['positionName']);
  if (positionName) {
    details.positionName = positionName;
  }
  const permissions = pickStringArray(combined, ['permissions']);
  if (permissions) {
    details.permissions = permissions;
  }

  return Object.keys(details).length ? details : undefined;
};

const buildEmployeeDetailsIndex = (
  items: CollectionItem[],
): EmployeeDetailsIndex => {
  const index: EmployeeDetailsIndex = {
    byId: new Map(),
    byTelegramUsername: new Map(),
    byUsername: new Map(),
  };
  items.forEach((item) => {
    const details = collectEmployeeDetails(item);
    if (!details) return;
    if (typeof details.telegram_id === 'number') {
      index.byId.set(String(details.telegram_id), details);
    }
    if (typeof details.telegram_username === 'string') {
      index.byTelegramUsername.set(
        details.telegram_username.toLowerCase(),
        details,
      );
    }
    if (typeof details.username === 'string') {
      index.byUsername.set(details.username.toLowerCase(), details);
    }
  });
  return index;
};

const mergeEmployeeDetails = (user: User, details?: Partial<User>): User => {
  if (!details) return user;
  const result: User = { ...user };
  const assignNumber = <K extends keyof User>(key: K) => {
    const next = details[key];
    if (typeof next !== 'number' || !Number.isFinite(next)) return;
    const current = result[key];
    if (typeof current === 'number' && Number.isFinite(current)) return;
    result[key] = next as User[K];
  };
  const assignString = <K extends keyof User>(key: K) => {
    const next = details[key];
    if (next === undefined || next === null) return;
    const normalized =
      typeof next === 'string'
        ? next.trim()
        : typeof next === 'number' && Number.isFinite(next)
          ? String(next)
          : '';
    if (!normalized) return;
    const current = result[key];
    if (
      current === undefined ||
      current === null ||
      (typeof current === 'string' && !current.trim())
    ) {
      result[key] = normalized as User[K];
    }
  };

  assignNumber('telegram_id');
  assignString('telegram_username');
  assignString('username');
  assignString('name');
  assignString('phone');
  assignString('mobNumber');
  assignString('email');
  assignString('role');
  assignNumber('access');
  assignString('roleId');
  assignString('roleName');
  assignString('departmentId');
  assignString('departmentName');
  assignString('divisionId');
  assignString('divisionName');
  assignString('positionId');
  assignString('positionName');
  if (
    (!result.permissions || !result.permissions.length) &&
    Array.isArray(details.permissions) &&
    details.permissions.length
  ) {
    result.permissions = details.permissions.slice();
  }
  return result;
};

const TOKEN_SPLIT_REGEX = /[\s,.;:/\\|_-]+/u;

const buildUserSearchTokens = (user: User): string[] => {
  const tokens = new Set<string>();
  const addValue = (value?: string | number | null) => {
    if (value === undefined || value === null) return;
    let text: string;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return;
      text = String(value);
    } else if (typeof value === 'string') {
      text = value.trim();
    } else {
      return;
    }
    if (!text) return;
    tokens.add(text);
    text
      .split(TOKEN_SPLIT_REGEX)
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .forEach((part) => tokens.add(part));
  };

  addValue(user.username ?? undefined);
  addValue(user.telegram_username ?? undefined);
  addValue(user.telegram_id ?? undefined);
  addValue(user.name ?? undefined);
  addValue(user.phone ?? undefined);
  addValue(user.mobNumber ?? undefined);
  addValue(user.email ?? undefined);
  addValue(user.role ?? undefined);
  addValue(user.roleName ?? undefined);
  addValue(user.departmentName ?? undefined);
  addValue(user.divisionName ?? undefined);
  addValue(user.positionName ?? undefined);
  if (Array.isArray(user.permissions)) {
    user.permissions.forEach((permission) => addValue(permission));
  }

  return Array.from(tokens);
};

const findEmployeeDetails = (
  user: User | undefined,
  index: EmployeeDetailsIndex,
  fallbackId?: string,
): Partial<User> | undefined => {
  const candidateId = fallbackId
    ? fallbackId.trim()
    : typeof user?.telegram_id === 'number'
      ? String(user.telegram_id)
      : undefined;
  if (candidateId) {
    const direct = index.byId.get(candidateId);
    if (direct) return direct;
  }
  const telegramUsername =
    typeof user?.telegram_username === 'string'
      ? user.telegram_username.trim().toLowerCase()
      : undefined;
  if (telegramUsername) {
    const direct = index.byTelegramUsername.get(telegramUsername);
    if (direct) return direct;
  }
  const username =
    typeof user?.username === 'string'
      ? user.username.trim().toLowerCase()
      : undefined;
  if (username) {
    const direct = index.byUsername.get(username);
    if (direct) return direct;
  }
  return undefined;
};

const USERS_ERROR_HINT = 'Не удалось загрузить пользователей';
const DUPLICATE_DIVISION_HINT_PREFIX = 'Обнаружены дублирующиеся отделы';
const TASK_SETTINGS_ERROR_HINT = 'Не удалось загрузить настройки задач';
const TASK_FIELD_SAVE_ERROR = 'Не удалось сохранить поле задачи';
const TASK_TYPE_SAVE_ERROR = 'Не удалось сохранить тип задачи';
const TASK_SETTINGS_DELETE_ERROR = 'Не удалось удалить настройку задачи';
const USER_DELETE_SUCCESS = 'Пользователь удалён';
const USER_DELETE_ERROR = 'Не удалось удалить пользователя';
const EMPLOYEE_DELETE_SUCCESS = 'Сотрудник удалён';
const EMPLOYEE_DELETE_ERROR = 'Не удалось удалить сотрудника';

type CollectionColumn =
  | (typeof collectionColumns)[number]
  | (typeof collectionObjectColumns)[number];

const hasAccessorKey = (
  column: CollectionColumn,
): column is CollectionColumn & { accessorKey: string } =>
  typeof (column as { accessorKey?: unknown }).accessorKey === 'string';

const formatCoordinatesValue = (
  latitude?: number,
  longitude?: number,
): string => {
  const parts: string[] = [];
  if (typeof latitude === 'number' && Number.isFinite(latitude)) {
    parts.push(latitude.toString());
  }
  if (typeof longitude === 'number' && Number.isFinite(longitude)) {
    parts.push(longitude.toString());
  }
  if (!parts.length) return SETTINGS_BADGE_EMPTY;
  return parts.join(', ');
};
const formatCoordinates = formatCoordinatesValue;

export default function CollectionsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeModule, setActiveModule] = useState<SettingsModuleKey>(() => {
    const param = searchParams.get('module');
    return isValidModuleKey(param) ? param : 'directories';
  });
  const [active, setActive] = useState<CollectionKey>('departments');
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [queries, setQueries] = useState<Record<CollectionKey, string>>(() =>
    createInitialQueries(),
  );
  const [searchDrafts, setSearchDrafts] = useState<
    Record<CollectionKey, string>
  >(() => createInitialQueries());
  const [form, setForm] = useState<ItemForm>(emptyItemForm);
  const [hint, setHint] = useState('');
  const [allDepartments, setAllDepartments] = useState<CollectionItem[]>([]);
  const [allDivisions, setAllDivisions] = useState<CollectionItem[]>([]);
  const [allPositions, setAllPositions] = useState<CollectionItem[]>([]);
  const [allObjects, setAllObjects] = useState<CollectionObject[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const limit = 10;
  const [users, setUsers] = useState<User[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [userQuery, setUserQuery] = useState('');
  const [userSearchDraft, setUserSearchDraft] = useState('');
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState<UserFormData>(emptyUser);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] =
    useState<CollectionItem | null>(null);
  const collectionSearchTimer = useRef<number>();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<
    string | undefined
  >(undefined);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [employeeFormMode, setEmployeeFormMode] = useState<'create' | 'update'>(
    'create',
  );
  const [taskFieldItems, setTaskFieldItems] = useState<CollectionItem[]>([]);
  const [taskTypeItems, setTaskTypeItems] = useState<CollectionItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const { user: currentUser } = useAuth();
  const [confirmUserDelete, setConfirmUserDelete] = useState(false);
  const [confirmEmployeeDelete, setConfirmEmployeeDelete] = useState(false);
  const canManageUsers = hasAccess(currentUser?.access, ACCESS_ADMIN);
  const actionButtonClass =
    'h-10 w-full max-w-[11rem] px-3 text-sm font-semibold sm:w-auto lg:h-8 lg:text-xs';

  useEffect(() => {
    return () => {
      if (collectionSearchTimer.current) {
        window.clearTimeout(collectionSearchTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const param = searchParams.get('module');
    const next = isValidModuleKey(param) ? param : 'directories';
    if (next !== activeModule) {
      setActiveModule(next);
    }
  }, [searchParams, activeModule]);

  const handleModuleChange = useCallback(
    (value: SettingsModuleKey) => {
      setActiveModule(value);
      const next = new URLSearchParams(searchParams.toString());
      if (value === 'directories') {
        next.delete('module');
      } else {
        next.set('module', value);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const loadObjects = useCallback(async () => {
    try {
      const objects = await fetchAllCollectionObjects('', 200);
      setAllObjects(objects);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось загрузить объекты';
      setHint((prev) => prev || message);
      setAllObjects([]);
    }
  }, []);
  const selectedCollectionInfo = useMemo(() => {
    if (
      !selectedCollection?.meta ||
      typeof selectedCollection.meta !== 'object'
    ) {
      return { readonly: false, notice: undefined as string | undefined };
    }
    const meta = selectedCollection.meta as {
      readonly?: unknown;
      legacy?: unknown;
      readonlyReason?: unknown;
    };
    const readonly = Boolean(meta.readonly ?? meta.legacy);
    const notice = readonly
      ? typeof meta.readonlyReason === 'string'
        ? meta.readonlyReason
        : meta.legacy
          ? 'Элемент перенесён из старой коллекции и доступен только для чтения.'
          : undefined
      : undefined;
    return { readonly, notice };
  }, [selectedCollection]);

  const selectedObjectDetails = useMemo(
    () =>
      selectedCollection?.type === 'objects'
        ? toCollectionObject(selectedCollection)
        : null,
    [selectedCollection],
  );

  const breadcrumbs = useMemo(
    () => [
      { label: t('nav.settings'), href: '/settings' },
      { label: t('collections.page.title') },
    ],
    [t],
  );

  const currentQuery = queries[active] ?? '';
  const currentSearchDraft = searchDrafts[active] ?? '';
  const isCollectionSearchSupported =
    activeModule === 'directories' &&
    active !== 'users' &&
    active !== 'fleets' &&
    active !== 'tasks';
  const isUserSearchActive =
    activeModule === 'directories' && active === 'users';
  const isEmployeeSearchActive =
    activeModule === 'directories' && active === 'employees';

  const applyCollectionSearch = useCallback(
    (raw: string) => {
      const normalized = raw.trim();
      setPage(1);
      setQueries((prev) => {
        if (prev[active] === normalized) {
          return prev;
        }
        return { ...prev, [active]: normalized };
      });
    },
    [active],
  );

  useEffect(() => {
    setSearchDrafts((prev) => ({ ...prev, [active]: currentQuery }));
  }, [active, currentQuery]);

  useEffect(() => {
    if (!isCollectionSearchSupported) {
      return;
    }
    if (collectionSearchTimer.current) {
      window.clearTimeout(collectionSearchTimer.current);
    }
    collectionSearchTimer.current = window.setTimeout(() => {
      applyCollectionSearch(currentSearchDraft);
    }, 400);
    return () => {
      if (collectionSearchTimer.current) {
        window.clearTimeout(collectionSearchTimer.current);
      }
    };
  }, [applyCollectionSearch, currentSearchDraft, isCollectionSearchSupported]);

  const load = useCallback(async () => {
    if (active === 'users' || active === 'tasks') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      if (active === 'fleets') {
        setItems([]);
        setTotal(0);
        setHint('');
        return;
      }
      if (active === 'employees') {
        const list = await fetchAllCollectionItems('employees');
        setItems(list);
        setTotal(list.length);
        setHint('');
        return;
      }
      if (active === 'objects') {
        const { items: loadedItems, total: loadedTotal } =
          await fetchCollectionObjects(currentQuery, page, limit);
        setItems(loadedItems);
        setTotal(loadedTotal);
        setHint('');
        return;
      }
      const d = (await fetchCollectionItems(
        active,
        currentQuery,
        page,
        limit,
      )) as { items: CollectionItem[]; total: number };
      setItems(d.items);
      setTotal(d.total);
      if (active === 'departments') {
        setAllDepartments((prev) => mergeById(prev, d.items));
      }
      if (active === 'divisions') {
        setAllDivisions((prev) => mergeById(prev, d.items));
      }
      if (active === 'positions') {
        setAllPositions((prev) => mergeById(prev, d.items));
      }
      setHint('');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить элементы';
      setItems([]);
      setTotal(0);
      setHint(message);
    } finally {
      setIsLoading(false);
    }
  }, [active, currentQuery, page]);

  const loadUsers = useCallback(async () => {
    try {
      const list = await fetchUsers();
      setUsers(list);
      setHint((prev) => (prev === USERS_ERROR_HINT ? '' : prev));
    } catch (error) {
      const message = error instanceof Error ? error.message : USERS_ERROR_HINT;
      setUsers([]);
      setHint(message || USERS_ERROR_HINT);
    }
  }, []);

  const loadTaskSettings = useCallback(async () => {
    setTasksLoading(true);
    try {
      const [fields, types] = await Promise.all([
        fetchAllCollectionItems('task_fields'),
        fetchAllCollectionItems('task_types'),
      ]);
      setTaskFieldItems(fields);
      setTaskTypeItems(types);
      setHint((prev) => (prev === TASK_SETTINGS_ERROR_HINT ? '' : prev));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : TASK_SETTINGS_ERROR_HINT;
      setTaskFieldItems([]);
      setTaskTypeItems([]);
      setHint(message || TASK_SETTINGS_ERROR_HINT);
    } finally {
      setTasksLoading(false);
    }
  }, [setHint]);

  useEffect(() => {
    if (active === 'tasks') {
      void loadTaskSettings();
    }
  }, [active, loadTaskSettings]);

  useEffect(() => {
    if (active === 'fixed_assets' && allObjects.length === 0) {
      void loadObjects();
    }
  }, [active, allObjects.length, loadObjects]);

  const saveTaskField = useCallback(
    async (item: CollectionItem, label: string) => {
      const trimmed = label.trim();
      if (!trimmed) {
        throw new Error('Название не может быть пустым');
      }
      try {
        if (item.meta?.virtual) {
          await createCollectionItem('task_fields', {
            name: item.name,
            value: trimmed,
          });
        } else {
          await updateCollectionItem(
            item._id,
            { name: item.name, value: trimmed },
            { collectionType: 'task_fields' },
          );
        }
        await loadTaskSettings();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : TASK_FIELD_SAVE_ERROR;
        throw new Error(message || TASK_FIELD_SAVE_ERROR);
      }
    },
    [loadTaskSettings],
  );

  const deleteTaskField = useCallback(
    async (item: CollectionItem) => {
      if (item.meta?.virtual) {
        return;
      }
      try {
        await removeCollectionItem(item._id);
        await loadTaskSettings();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : TASK_SETTINGS_DELETE_ERROR;
        throw new Error(message || TASK_SETTINGS_DELETE_ERROR);
      }
    },
    [loadTaskSettings],
  );

  const saveTaskType = useCallback(
    async (
      item: CollectionItem,
      payload: { label: string; tg_theme_url: string; tg_photos_url: string },
    ) => {
      const trimmedLabel = payload.label.trim();
      if (!trimmedLabel) {
        throw new Error('Название не может быть пустым');
      }
      const trimmedUrl = payload.tg_theme_url.trim();
      const trimmedPhotosUrl = payload.tg_photos_url.trim();
      try {
        const buildMeta = () => {
          const meta: Record<string, string> = {};
          if (trimmedUrl) meta.tg_theme_url = trimmedUrl;
          if (trimmedPhotosUrl) meta.tg_photos_url = trimmedPhotosUrl;
          return meta;
        };
        if (item.meta?.virtual) {
          const meta = buildMeta();
          await createCollectionItem('task_types', {
            name: item.name,
            value: trimmedLabel,
            ...(Object.keys(meta).length ? { meta } : {}),
          });
        } else {
          const meta = buildMeta();
          if (!trimmedUrl) {
            meta.tg_theme_url = '';
          }
          if (!trimmedPhotosUrl) {
            meta.tg_photos_url = '';
          }
          await updateCollectionItem(
            item._id,
            {
              name: item.name,
              value: trimmedLabel,
              meta,
            },
            { collectionType: 'task_types' },
          );
        }
        await loadTaskSettings();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : TASK_TYPE_SAVE_ERROR;
        throw new Error(message || TASK_TYPE_SAVE_ERROR);
      }
    },
    [loadTaskSettings],
  );

  const deleteTaskType = useCallback(
    async (item: CollectionItem) => {
      if (item.meta?.virtual) {
        return;
      }
      try {
        await removeCollectionItem(item._id);
        await loadTaskSettings();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : TASK_SETTINGS_DELETE_ERROR;
        throw new Error(message || TASK_SETTINGS_DELETE_ERROR);
      }
    },
    [loadTaskSettings],
  );

  useEffect(() => {
    if (active === 'users' || active === 'employees') {
      setUserSearchDraft(userQuery);
    }
  }, [active, userQuery]);

  useEffect(() => {
    if (collectionModalOpen && selectedCollection?.type === 'divisions') {
      void loadUsers();
    }
  }, [collectionModalOpen, selectedCollection, loadUsers]);

  useEffect(() => {
    const loadReferenceCollections = async () => {
      const [departmentsResult, divisionsResult, positionsResult] =
        await Promise.allSettled([
          fetchAllCollectionItems('departments'),
          fetchAllCollectionItems('divisions'),
          fetchAllCollectionItems('positions'),
        ]);

      const applyResult = (
        result: PromiseSettledResult<CollectionItem[]>,
        setter: React.Dispatch<React.SetStateAction<CollectionItem[]>>,
        fallbackMessage: string,
      ) => {
        if (result.status === 'fulfilled') {
          setter(result.value);
          return;
        }
        const reason = result.reason;
        const message =
          reason instanceof Error && reason.message
            ? reason.message
            : fallbackMessage;
        setHint((prev) => prev || message);
      };

      applyResult(
        departmentsResult,
        setAllDepartments,
        'Не удалось загрузить департаменты',
      );
      applyResult(
        divisionsResult,
        setAllDivisions,
        'Не удалось загрузить отделы',
      );
      applyResult(
        positionsResult,
        setAllPositions,
        'Не удалось загрузить должности',
      );
    };

    void loadReferenceCollections();
    fetchRoles()
      .then((list) => setAllRoles(list))
      .catch((error) => {
        setAllRoles([]);
        const message =
          error instanceof Error ? error.message : 'Не удалось загрузить роли';
        setHint((prev) => prev || message);
      });
  }, []);

  useEffect(() => {
    if (active !== 'users' && active !== 'tasks') {
      void load();
      if (active !== 'fleets') {
        setForm(emptyItemForm);
      }
    } else {
      setHint('');
    }
  }, [load, active]);

  useEffect(() => {
    if (active === 'users') {
      void loadUsers();
      setUserForm(emptyUser);
      setSelectedEmployeeId(undefined);
    }
    if (active === 'employees') {
      void loadUsers();
      setSelectedEmployeeId(undefined);
      setEmployeeFormMode('create');
      setIsEmployeeModalOpen(false);
    }
    if (active !== 'employees') {
      setIsEmployeeModalOpen(false);
    }
    if (
      active === 'users' ||
      active === 'employees' ||
      active === 'fleets' ||
      active === 'tasks'
    ) {
      setCollectionModalOpen(false);
    }
    if (active !== 'users') {
      setUserModalOpen(false);
      setUserForm(emptyUser);
    }
  }, [active, loadUsers]);

  const openCollectionModal = (item?: CollectionItem) => {
    if (item) {
      if (item.type === 'objects') {
        const object = toCollectionObject(item);
        setForm({
          _id: object._id,
          name: object.name,
          value: object.address,
          meta: object.meta,
          address: object.address,
          latitude:
            object.latitude !== undefined ? object.latitude.toString() : '',
          longitude:
            object.longitude !== undefined ? object.longitude.toString() : '',
        });
      } else if (item.type === 'fixed_assets') {
        const meta = (item.meta ?? {}) as Record<string, unknown>;
        const description =
          typeof meta.description === 'string' ? meta.description : '';
        const location = meta.location as Record<string, unknown> | undefined;
        const locationSource =
          location?.source === 'object' ? 'object' : 'manual';
        const objectId =
          typeof location?.objectId === 'string' ? location.objectId : '';
        const address =
          typeof location?.address === 'string' ? location.address : '';
        const latitude =
          typeof location?.latitude === 'number'
            ? location.latitude.toString()
            : '';
        const longitude =
          typeof location?.longitude === 'number'
            ? location.longitude.toString()
            : '';
        setForm({
          _id: item._id,
          name: item.name,
          value: item.value,
          meta: {
            description,
            locationSource,
            locationObjectId: objectId,
          },
          address,
          latitude,
          longitude,
        });
      } else {
        setForm({
          _id: item._id,
          name: item.name,
          value: item.value,
          meta: item.meta,
        });
      }
      setSelectedCollection(item);
    } else {
      setForm(emptyItemForm);
      setSelectedCollection(null);
    }
    setCollectionModalOpen(true);
  };

  const closeCollectionModal = () => {
    setCollectionModalOpen(false);
    setSelectedCollection(null);
    setForm(emptyItemForm);
  };

  const mapUserToForm = (user?: User): UserFormData => ({
    telegram_id: user?.telegram_id,
    username: user?.telegram_username ?? user?.username ?? '',
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    mobNumber: user?.mobNumber ?? '',
    email: user?.email ?? '',
    role: user?.role ?? 'user',
    access: user?.access ?? 1,
    roleId: user?.roleId ?? '',
    departmentId: user?.departmentId ?? '',
    divisionId: user?.divisionId ?? '',
    positionId: user?.positionId ?? '',
  });

  const openUserModal = (user?: User) => {
    setUserForm(user ? mapUserToForm(user) : emptyUser);
    setUserModalOpen(true);
  };

  const closeUserModal = useCallback(() => {
    setUserModalOpen(false);
    setUserForm(emptyUser);
  }, []);

  const openEmployeeModal = (user?: User) => {
    if (user) {
      setSelectedEmployeeId(String(user.telegram_id));
      setEmployeeFormMode('update');
    } else {
      setSelectedEmployeeId(undefined);
      setEmployeeFormMode('create');
    }
    setIsEmployeeModalOpen(true);
  };

  const updateCollectionSearchDraft = useCallback(
    (value: string) => {
      setSearchDrafts((prev) => ({ ...prev, [active]: value }));
    },
    [active],
  );

  const submitCollectionSearch = useCallback(
    (value?: string) => {
      if (collectionSearchTimer.current) {
        window.clearTimeout(collectionSearchTimer.current);
      }
      applyCollectionSearch(value ?? currentSearchDraft);
    },
    [applyCollectionSearch, currentSearchDraft],
  );

  const handleCollectionSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isCollectionSearchSupported) {
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        submitCollectionSearch(event.currentTarget.value);
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        updateCollectionSearchDraft('');
        submitCollectionSearch('');
      }
    },
    [
      isCollectionSearchSupported,
      submitCollectionSearch,
      updateCollectionSearchDraft,
    ],
  );

  const resetCollectionSearch = useCallback(() => {
    updateCollectionSearchDraft('');
    submitCollectionSearch('');
  }, [submitCollectionSearch, updateCollectionSearchDraft]);

  const submitUserSearch = useCallback(
    (event?: React.FormEvent) => {
      event?.preventDefault();
      setUserPage(1);
      setUserQuery(userSearchDraft.trim());
      setSelectedEmployeeId(undefined);
    },
    [userSearchDraft],
  );

  const handleUserSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isUserSearchActive) {
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        submitUserSearch();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setUserSearchDraft('');
        submitUserSearch();
      }
    },
    [isUserSearchActive, submitUserSearch],
  );

  const handleEmployeeSaved = (updated: UserDetails) => {
    void loadUsers();
    if (updated.telegram_id !== undefined) {
      setSelectedEmployeeId(String(updated.telegram_id));
      setEmployeeFormMode('update');
    }
  };

  const executeUserDelete = useCallback(async () => {
    if (!userForm.telegram_id) {
      setConfirmUserDelete(false);
      return;
    }
    try {
      await deleteUserApi(userForm.telegram_id);
      showToast(USER_DELETE_SUCCESS, 'success');
      setSelectedEmployeeId((prev) =>
        prev === String(userForm.telegram_id) ? undefined : prev,
      );
      closeUserModal();
      await loadUsers();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : USER_DELETE_ERROR;
      showToast(message || USER_DELETE_ERROR, 'error');
    } finally {
      setConfirmUserDelete(false);
    }
  }, [userForm.telegram_id, closeUserModal, loadUsers, setSelectedEmployeeId]);

  const executeEmployeeDelete = useCallback(async () => {
    if (!selectedEmployeeId) {
      setConfirmEmployeeDelete(false);
      return;
    }
    try {
      await deleteUserApi(selectedEmployeeId);
      showToast(EMPLOYEE_DELETE_SUCCESS, 'success');
      setIsEmployeeModalOpen(false);
      setSelectedEmployeeId(undefined);
      setEmployeeFormMode('create');
      await loadUsers();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : EMPLOYEE_DELETE_ERROR;
      showToast(message || EMPLOYEE_DELETE_ERROR, 'error');
    } finally {
      setConfirmEmployeeDelete(false);
    }
  }, [selectedEmployeeId, loadUsers]);

  const submit = async () => {
    if (active === 'fleets') return;
    const trimmedName = form.name.trim();
    if (!trimmedName) return;
    if (form._id && selectedCollectionInfo.readonly) {
      setHint(
        selectedCollectionInfo.notice ??
          'Элемент перенесён из старой коллекции и доступен только для чтения.',
      );
      return;
    }
    let valueToSave = form.value;
    let metaToSave: Record<string, unknown> | undefined;
    if (active === 'departments') {
      valueToSave = safeParseIds(form.value).join(',');
    } else if (active === 'objects') {
      const address = (form.address ?? form.value ?? '').trim();
      if (!address) {
        setHint('Укажите адрес объекта.');
        return;
      }
      valueToSave = address;
      const latitude = parseCoordinateInput(form.latitude);
      const longitude = parseCoordinateInput(form.longitude);
      const meta: Record<string, unknown> = {
        ...(form.meta ?? {}),
        address,
      };
      if (latitude !== undefined) {
        meta.latitude = latitude;
      }
      if (longitude !== undefined) {
        meta.longitude = longitude;
      }
      if (latitude !== undefined || longitude !== undefined) {
        meta.location = { lat: latitude, lng: longitude };
      }
      metaToSave = meta;
    } else if (active === 'fixed_assets') {
      valueToSave = form.value.trim();
      if (!valueToSave) {
        setHint('Укажите инвентарный номер.');
        return;
      }
      const meta = (form.meta ?? {}) as Record<string, unknown>;
      const description =
        typeof meta.description === 'string' ? meta.description.trim() : '';
      const locationSource =
        meta.locationSource === 'object' ? 'object' : 'manual';
      const location: Record<string, unknown> = {
        source: locationSource,
      };
      if (locationSource === 'object') {
        const objectId =
          typeof meta.locationObjectId === 'string'
            ? meta.locationObjectId.trim()
            : '';
        if (objectId) {
          const selectedObject = allObjects.find(
            (object) => object._id === objectId,
          );
          location.objectId = objectId;
          if (selectedObject) {
            location.address = selectedObject.address;
            if (selectedObject.latitude !== undefined) {
              location.latitude = selectedObject.latitude;
            }
            if (selectedObject.longitude !== undefined) {
              location.longitude = selectedObject.longitude;
            }
          }
        }
      } else {
        const address = (form.address ?? '').trim();
        if (address) {
          location.address = address;
        }
        const latitude = parseCoordinateInput(form.latitude);
        const longitude = parseCoordinateInput(form.longitude);
        if (latitude !== undefined) {
          location.latitude = latitude;
        }
        if (longitude !== undefined) {
          location.longitude = longitude;
        }
      }
      metaToSave = {
        ...(description ? { description } : {}),
        location,
      };
    } else {
      valueToSave = form.value.trim();
      if (!valueToSave) {
        setHint('Заполните значение элемента.');
        return;
      }
    }
    try {
      let saved: CollectionItem | null = null;
      const payload = {
        name: trimmedName,
        value: valueToSave,
        ...(metaToSave ? { meta: metaToSave } : {}),
      };
      if (form._id) {
        saved = await updateCollectionItem(form._id, payload, {
          collectionType: active,
        });
      } else {
        saved = await createCollectionItem(active, payload);
      }
      if (!saved) {
        throw new Error('Сервер не вернул сохранённый элемент');
      }
      setHint('');
      await load();
      closeCollectionModal();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось сохранить элемент';
      setHint(message);
    }
  };

  const remove = async () => {
    if (!form._id) return;
    if (selectedCollectionInfo.readonly) {
      setHint(
        selectedCollectionInfo.notice ??
          'Элемент перенесён из старой коллекции и доступен только для чтения.',
      );
      return;
    }
    try {
      await removeCollectionItem(form._id);
      setHint('');
      await load();
      closeCollectionModal();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setHint(msg);
    }
  };

  const submitUser = async () => {
    if (!userForm.telegram_id) return;
    const id = userForm.telegram_id;
    if (!users.find((u) => u.telegram_id === id)) {
      await createUserApi(id, userForm.username, userForm.roleId);
    }
    const { telegram_id: _telegramId, ...data } = userForm;
    await updateUserApi(id, data);
    void loadUsers();
    closeUserModal();
  };

  const departmentMap = useMemo(() => {
    const map = new Map<string, string>();
    allDepartments.forEach((d) => map.set(d._id, d.name));
    return map;
  }, [allDepartments]);

  const divisionMap = useMemo(() => {
    const map = new Map<string, string>();
    allDivisions.forEach((d) => map.set(d._id, d.name));
    return map;
  }, [allDivisions]);

  const positionMap = useMemo(() => {
    const map = new Map<string, string>();
    allPositions.forEach((position) => map.set(position._id, position.name));
    return map;
  }, [allPositions]);

  const employeeDetailsIndex = useMemo(
    () => buildEmployeeDetailsIndex(items),
    [items],
  );

  const enrichUserWithEmployeeDetails = useCallback(
    (user: User) =>
      mergeEmployeeDetails(
        user,
        findEmployeeDetails(user, employeeDetailsIndex),
      ),
    [employeeDetailsIndex],
  );

  const enrichedUsers = useMemo(
    () => users.map((user) => enrichUserWithEmployeeDetails(user)),
    [users, enrichUserWithEmployeeDetails],
  );

  const roleMap = useMemo(() => {
    const map = new Map<string, string>();
    allRoles.forEach((role) => map.set(role._id, role.name));
    return map;
  }, [allRoles]);

  const { divisionOwners, duplicateDivisionIds } = useMemo(() => {
    const owners = new Map<string, string>();
    const duplicates = new Set<string>();
    allDepartments.forEach((department) => {
      safeParseIds(department.value).forEach((divisionId) => {
        const currentOwner = owners.get(divisionId);
        if (currentOwner && currentOwner !== department._id) {
          duplicates.add(divisionId);
          return;
        }
        if (!currentOwner) {
          owners.set(divisionId, department._id);
        }
      });
    });
    return {
      divisionOwners: owners,
      duplicateDivisionIds: Array.from(duplicates),
    };
  }, [allDepartments]);

  const duplicateDivisionHint = useMemo(() => {
    if (!duplicateDivisionIds.length) return '';
    const names = duplicateDivisionIds
      .map(
        (id) =>
          divisionMap.get(id) ??
          allDivisions.find((division) => division._id === id)?.name ??
          id,
      )
      .filter((name): name is string => Boolean(name));
    const suffix = names.length ? `: ${names.join(', ')}.` : '.';
    return `${DUPLICATE_DIVISION_HINT_PREFIX}${suffix}`;
  }, [duplicateDivisionIds, divisionMap, allDivisions]);

  useEffect(() => {
    if (duplicateDivisionHint) {
      setHint((prev) => (prev ? prev : duplicateDivisionHint));
      return;
    }
    setHint((prev) =>
      prev && prev.startsWith(DUPLICATE_DIVISION_HINT_PREFIX) ? '' : prev,
    );
  }, [duplicateDivisionHint]);

  const getItemDisplayValue = useCallback(
    (item: CollectionItem, type: CollectionKey) => {
      if (type === 'departments') {
        const ids = safeParseIds(item.value);
        if (!ids.length) return SETTINGS_BADGE_EMPTY;
        const names = ids
          .map(
            (id) =>
              divisionMap.get(id) ??
              allDivisions.find((division) => division._id === id)?.name ??
              id,
          )
          .filter((name): name is string => Boolean(name));
        return names.length ? names.join('\n') : SETTINGS_BADGE_EMPTY;
      }
      if (type === 'divisions') {
        const departmentName =
          departmentMap.get(item.value) ??
          allDepartments.find((department) => department._id === item.value)
            ?.name ??
          item.value;
        return departmentName
          ? formatCollectionRawValue(departmentName)
          : SETTINGS_BADGE_EMPTY;
      }
      if (type === 'positions') {
        const divisionName =
          divisionMap.get(item.value) ??
          allDivisions.find((division) => division._id === item.value)?.name ??
          item.value;
        return divisionName
          ? formatCollectionRawValue(divisionName)
          : SETTINGS_BADGE_EMPTY;
      }
      if (type === 'objects') {
        const object = toCollectionObject(item);
        const coordinates = formatCoordinatesValue(
          object.latitude,
          object.longitude,
        );
        if (coordinates !== SETTINGS_BADGE_EMPTY) {
          return coordinates;
        }
        const address = object.address?.trim();
        return address || SETTINGS_BADGE_EMPTY;
      }
      const formatted = formatCollectionRawValue(item.value ?? '');
      return formatted || SETTINGS_BADGE_EMPTY;
    },
    [
      allDepartments,
      allDivisions,
      departmentMap,
      divisionMap,
      formatCoordinatesValue,
    ],
  );

  const formatMetaSummary = useCallback((meta?: CollectionItem['meta']) => {
    if (!meta) return SETTINGS_BADGE_EMPTY;
    const summary = summarizeRecord(meta as Record<string, unknown>);
    return summary || SETTINGS_BADGE_EMPTY;
  }, []);

  const parseCoordinateInput = useCallback((value?: string) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, []);

  const copyIdLabel = t('collections.actions.copyId');
  const copiedIdLabel = t('collections.actions.copiedId');

  const localizeColumns = useCallback(
    (columns: CollectionColumn[]) =>
      columns.map((column) => {
        if (!hasAccessorKey(column)) {
          return column;
        }
        switch (column.accessorKey) {
          case 'name':
            return { ...column, header: t('collections.table.columns.name') };
          case 'value':
            return { ...column, header: t('collections.table.columns.value') };
          case 'displayValue':
            return {
              ...column,
              header: t('collections.table.columns.relations'),
            };
          case 'type':
            return { ...column, header: t('collections.table.columns.type') };
          case '_id':
            return {
              ...column,
              header: t('collections.table.columns.id'),
              cell: ({ getValue }) => {
                const raw = getValue<string>();
                const safeValue = typeof raw === 'string' ? raw : '';
                if (!safeValue) {
                  return (
                    <span className="text-xs text-[color:var(--color-gray-500)] dark:text-[color:var(--color-gray-300)]">
                      {SETTINGS_BADGE_EMPTY}
                    </span>
                  );
                }
                return (
                  <CopyableId
                    value={safeValue}
                    copyHint={copyIdLabel}
                    copiedHint={copiedIdLabel}
                  />
                );
              },
            };
          case 'metaSummary':
            return {
              ...column,
              header: t('collections.table.columns.meta'),
            };
          case 'address':
            return {
              ...column,
              header: t('collections.table.columns.address'),
            };
          case 'coordinates':
            return {
              ...column,
              header: t('collections.table.columns.coordinates'),
            };
          default:
            return column;
        }
      }),
    [copiedIdLabel, copyIdLabel, t],
  );

  const localizedCollectionColumns = useMemo(
    () => localizeColumns(collectionColumns),
    [localizeColumns],
  );

  const localizedObjectColumns = useMemo(
    () => localizeColumns(collectionObjectColumns),
    [localizeColumns],
  );

  const collectionSearchPlaceholder = t('collections.search.placeholder');
  const collectionSearchHint = t('collections.search.hint');
  const collectionSearchCta = t('collections.actions.search');
  const collectionResetCta = t('collections.actions.reset');
  const collectionAddCta = t('collections.actions.add');
  const collectionEmptyTitle = t('collections.table.empty.title');
  const collectionEmptyDescription = t('collections.table.empty.description');
  const collectionEmptyAction = t('collections.table.empty.action');
  const userSearchPlaceholder = t('collections.users.searchPlaceholder');
  const userAddCta = t('collections.users.add');
  const employeeSearchPlaceholder = t(
    'collections.employees.searchPlaceholder',
  );
  const employeeAddCta = t('collections.employees.add');

  const buildCollectionColumns = useCallback(
    (excludedKeys: string[]) =>
      localizedCollectionColumns.filter(
        (column) =>
          !hasAccessorKey(column) || !excludedKeys.includes(column.accessorKey),
      ),
    [localizedCollectionColumns],
  );

  const departmentColumns = useMemo(
    () => buildCollectionColumns(['value', 'type', 'metaSummary']),
    [buildCollectionColumns],
  );

  const divisionColumns = useMemo(
    () => buildCollectionColumns(['type', 'metaSummary']),
    [buildCollectionColumns],
  );

  const positionColumns = useMemo(
    () => buildCollectionColumns(['type', 'metaSummary']),
    [buildCollectionColumns],
  );

  const renderDepartmentValueField = useCallback(
    (
      currentForm: ItemForm,
      handleChange: (next: ItemForm) => void,
      options?: { readonly?: boolean },
    ) => {
      const selected = safeParseIds(currentForm.value);
      const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const values = Array.from(event.target.selectedOptions).map(
          (option) => option.value,
        );
        handleChange({ ...currentForm, value: values.join(',') });
      };
      return (
        <select
          multiple
          className="min-h-[8rem] w-full rounded border px-3 py-2"
          value={selected}
          onChange={handleSelect}
          disabled={options?.readonly}
        >
          {allDivisions
            .filter((division) => {
              const ownerId = divisionOwners.get(division._id);
              if (!ownerId) return true;
              const isSelected = selected.includes(division._id);
              if (isSelected) return true;
              if (!currentForm._id) return false;
              return ownerId === currentForm._id;
            })
            .map((division) => (
              <option key={division._id} value={division._id}>
                {division.name}
              </option>
            ))}
        </select>
      );
    },
    [allDivisions, divisionOwners],
  );

  const renderDivisionValueField = useCallback(
    (
      currentForm: ItemForm,
      handleChange: (next: ItemForm) => void,
      options?: { readonly?: boolean },
    ) => (
      <select
        className="h-10 w-full rounded border px-3"
        value={currentForm.value}
        onChange={(event) =>
          handleChange({ ...currentForm, value: event.target.value })
        }
        required
        disabled={options?.readonly}
      >
        <option value="" disabled>
          Выберите департамент
        </option>
        {allDepartments.map((department) => (
          <option key={department._id} value={department._id}>
            {department.name}
          </option>
        ))}
      </select>
    ),
    [allDepartments],
  );

  const renderPositionValueField = useCallback(
    (
      currentForm: ItemForm,
      handleChange: (next: ItemForm) => void,
      options?: { readonly?: boolean },
    ) => (
      <select
        className="h-10 w-full rounded border px-3"
        value={currentForm.value}
        onChange={(event) =>
          handleChange({ ...currentForm, value: event.target.value })
        }
        required
        disabled={options?.readonly}
      >
        <option value="" disabled>
          Выберите отдел
        </option>
        {allDivisions.map((division) => (
          <option key={division._id} value={division._id}>
            {division.name}
          </option>
        ))}
      </select>
    ),
    [allDivisions],
  );

  const renderObjectValueField = useCallback(
    (
      currentForm: ItemForm,
      handleChange: (next: ItemForm) => void,
      options?: { readonly?: boolean },
    ) => {
      const readonly = options?.readonly;
      const addressValue = currentForm.address ?? currentForm.value;
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <UiFormGroup
            className="sm:col-span-2"
            label="Адрес объекта"
            htmlFor="collection-object-address"
          >
            <UiInput
              id="collection-object-address"
              value={addressValue}
              placeholder="Адрес объекта"
              onChange={(event) =>
                handleChange({
                  ...currentForm,
                  address: event.target.value,
                  value: event.target.value,
                })
              }
              required
              disabled={readonly}
            />
          </UiFormGroup>
          <UiFormGroup label="Широта" htmlFor="collection-object-lat">
            <UiInput
              id="collection-object-lat"
              value={currentForm.latitude ?? ''}
              placeholder="Широта"
              onChange={(event) =>
                handleChange({
                  ...currentForm,
                  latitude: event.target.value,
                })
              }
              disabled={readonly}
            />
          </UiFormGroup>
          <UiFormGroup label="Долгота" htmlFor="collection-object-lng">
            <UiInput
              id="collection-object-lng"
              value={currentForm.longitude ?? ''}
              placeholder="Долгота"
              onChange={(event) =>
                handleChange({
                  ...currentForm,
                  longitude: event.target.value,
                })
              }
              disabled={readonly}
            />
          </UiFormGroup>
        </div>
      );
    },
    [],
  );

  const renderFixedAssetValueField = useCallback(
    (
      currentForm: ItemForm,
      handleChange: (next: ItemForm) => void,
      options?: { readonly?: boolean },
    ) => {
      const readonly = options?.readonly;
      const meta = (currentForm.meta ?? {}) as Record<string, unknown>;
      const description =
        typeof meta.description === 'string' ? meta.description : '';
      const locationSource =
        meta.locationSource === 'object' ? 'object' : 'manual';
      const selectedObjectId =
        typeof meta.locationObjectId === 'string' ? meta.locationObjectId : '';

      const updateMeta = (nextMeta: Record<string, unknown>) =>
        handleChange({ ...currentForm, meta: nextMeta });

      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <UiFormGroup label="Инвентарный номер" htmlFor="fixed-asset-number">
            <UiInput
              id="fixed-asset-number"
              value={currentForm.value}
              placeholder="Инвентарный номер"
              onChange={(event) =>
                handleChange({ ...currentForm, value: event.target.value })
              }
              required
              disabled={readonly}
            />
          </UiFormGroup>
          <UiFormGroup
            className="sm:col-span-2 lg:col-span-3"
            label="Описание"
            htmlFor="fixed-asset-description"
          >
            <textarea
              id="fixed-asset-description"
              className="textarea textarea-bordered min-h-[96px] w-full"
              value={description}
              placeholder="Описание, примечания"
              onChange={(event) =>
                updateMeta({ ...meta, description: event.target.value })
              }
              disabled={readonly}
            />
          </UiFormGroup>
          <UiFormGroup
            className="sm:col-span-2 lg:col-span-3"
            label="Расположение"
            htmlFor="asset-location-source"
          >
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm font-medium">
                <UiRadio
                  name="asset-location-source"
                  value="object"
                  checked={locationSource === 'object'}
                  onChange={() =>
                    updateMeta({ ...meta, locationSource: 'object' })
                  }
                  disabled={readonly}
                />
                Из списка объектов
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <UiRadio
                  name="asset-location-source"
                  value="manual"
                  checked={locationSource === 'manual'}
                  onChange={() =>
                    updateMeta({ ...meta, locationSource: 'manual' })
                  }
                  disabled={readonly}
                />
                Вручную
              </label>
            </div>
            {locationSource === 'object' ? (
              <UiSelect
                className="mt-2"
                value={selectedObjectId}
                onChange={(event) =>
                  updateMeta({
                    ...meta,
                    locationObjectId: event.target.value,
                  })
                }
                disabled={readonly}
              >
                <option value="">Выберите объект</option>
                {allObjects.map((object) => (
                  <option key={object._id} value={object._id}>
                    {object.name} — {object.address}
                  </option>
                ))}
              </UiSelect>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <UiFormGroup label="Адрес" htmlFor="fixed-asset-address">
                  <UiInput
                    id="fixed-asset-address"
                    value={currentForm.address ?? ''}
                    placeholder="Адрес или описание места"
                    onChange={(event) =>
                      handleChange({
                        ...currentForm,
                        address: event.target.value,
                      })
                    }
                    disabled={readonly}
                  />
                </UiFormGroup>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:col-span-1">
                  <UiFormGroup label="Широта" htmlFor="fixed-asset-lat">
                    <UiInput
                      id="fixed-asset-lat"
                      value={currentForm.latitude ?? ''}
                      placeholder="Широта"
                      onChange={(event) =>
                        handleChange({
                          ...currentForm,
                          latitude: event.target.value,
                        })
                      }
                      disabled={readonly}
                    />
                  </UiFormGroup>
                  <UiFormGroup label="Долгота" htmlFor="fixed-asset-lng">
                    <UiInput
                      id="fixed-asset-lng"
                      value={currentForm.longitude ?? ''}
                      placeholder="Долгота"
                      onChange={(event) =>
                        handleChange({
                          ...currentForm,
                          longitude: event.target.value,
                        })
                      }
                      disabled={readonly}
                    />
                  </UiFormGroup>
                </div>
              </div>
            )}
          </UiFormGroup>
        </div>
      );
    },
    [allObjects],
  );

  const totalPages = Math.ceil(total / limit) || 1;
  const filteredUsers = useMemo(() => {
    const trimmed = userQuery.trim();
    if (!trimmed) {
      return enrichedUsers;
    }
    return matchSorter<User>(enrichedUsers, trimmed, {
      keys: [
        {
          key: (item: User) => item.username ?? '',
          threshold: rankings.STARTS_WITH,
        },
        {
          key: (item: User) => item.telegram_username ?? '',
          threshold: rankings.STARTS_WITH,
        },
        {
          key: (item: User) =>
            item.telegram_id !== undefined && item.telegram_id !== null
              ? String(item.telegram_id)
              : '',
          threshold: rankings.STARTS_WITH,
        },
        {
          key: (item: User) => buildUserSearchTokens(item),
          threshold: rankings.CONTAINS,
        },
      ],
    });
  }, [userQuery, enrichedUsers]);
  const userTotalPages = Math.ceil(filteredUsers.length / limit) || 1;
  const paginatedUsers = filteredUsers.slice(
    (userPage - 1) * limit,
    userPage * limit,
  );

  const employeeRows = useMemo<EmployeeRow[]>(
    () =>
      paginatedUsers.map((user) => {
        const mergedUser = enrichUserWithEmployeeDetails(user);
        const roleId =
          typeof mergedUser.roleId === 'string' ? mergedUser.roleId.trim() : '';
        const departmentId =
          typeof mergedUser.departmentId === 'string'
            ? mergedUser.departmentId.trim()
            : '';
        const divisionId =
          typeof mergedUser.divisionId === 'string'
            ? mergedUser.divisionId.trim()
            : '';
        const positionId =
          typeof mergedUser.positionId === 'string'
            ? mergedUser.positionId.trim()
            : '';
        const roleNameFromMap = resolveReferenceName(
          roleMap,
          roleId,
          mergedUser.roleName,
        );
        const departmentName = resolveReferenceName(
          departmentMap,
          departmentId,
          mergedUser.departmentName,
        );
        const divisionName = resolveReferenceName(
          divisionMap,
          divisionId,
          mergedUser.divisionName,
        );
        const positionName = resolveReferenceName(
          positionMap,
          positionId,
          mergedUser.positionName,
        );
        const roleLabel =
          roleNameFromMap ||
          (mergedUser.role ? formatRoleName(mergedUser.role) : '');
        return buildEmployeeRow({
          ...mergedUser,
          roleId,
          departmentId,
          divisionId,
          positionId,
          roleName: roleLabel,
          departmentName,
          divisionName,
          positionName,
        });
      }),
    [
      paginatedUsers,
      roleMap,
      departmentMap,
      divisionMap,
      positionMap,
      enrichUserWithEmployeeDetails,
    ],
  );

  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeId) return undefined;
    const base = enrichedUsers.find(
      (u) => String(u.telegram_id) === selectedEmployeeId,
    );
    if (base) {
      return base;
    }
    const fallbackDetails = findEmployeeDetails(
      undefined,
      employeeDetailsIndex,
      selectedEmployeeId,
    );
    if (!fallbackDetails) return undefined;
    const fallbackUser: User = {};
    if (typeof fallbackDetails.telegram_id === 'number') {
      fallbackUser.telegram_id = fallbackDetails.telegram_id;
    } else {
      const parsedId = Number(selectedEmployeeId);
      if (Number.isFinite(parsedId)) {
        fallbackUser.telegram_id = parsedId;
      }
    }
    if (fallbackDetails.username) {
      fallbackUser.username = fallbackDetails.username;
    }
    if (fallbackDetails.telegram_username) {
      fallbackUser.telegram_username = fallbackDetails.telegram_username;
    }
    return mergeEmployeeDetails(fallbackUser, fallbackDetails);
  }, [employeeDetailsIndex, enrichedUsers, selectedEmployeeId]);

  const selectedDepartmentDivisionNames = useMemo(() => {
    if (!selectedCollection || selectedCollection.type !== 'departments') {
      return [] as string[];
    }
    const ids = safeParseIds(selectedCollection.value);
    return ids
      .map(
        (id) =>
          divisionMap.get(id) ??
          allDivisions.find((division) => division._id === id)?.name ??
          id,
      )
      .filter((name): name is string => Boolean(name));
  }, [selectedCollection, divisionMap, allDivisions]);

  const selectedDivisionDepartmentName = useMemo(() => {
    if (!selectedCollection || selectedCollection.type !== 'divisions') {
      return SETTINGS_BADGE_EMPTY;
    }
    const departmentId = selectedCollection.value;
    if (!departmentId) return SETTINGS_BADGE_EMPTY;
    return (
      departmentMap.get(departmentId) ??
      allDepartments.find((department) => department._id === departmentId)
        ?.name ??
      departmentId
    );
  }, [selectedCollection, departmentMap, allDepartments]);

  const selectedDivisionPositionNames = useMemo(() => {
    if (!selectedCollection || selectedCollection.type !== 'divisions') {
      return [] as string[];
    }
    return allPositions
      .filter((position) => position.value === selectedCollection._id)
      .map((position) => position.name)
      .filter((name): name is string => Boolean(name));
  }, [selectedCollection, allPositions]);

  const selectedDivisionEmployeeNames = useMemo(() => {
    if (!selectedCollection || selectedCollection.type !== 'divisions') {
      return [] as string[];
    }
    return enrichedUsers
      .filter((user) => user.divisionId === selectedCollection._id)
      .map((user) => {
        if (user.name && user.name.trim()) return user.name.trim();
        if (user.username && user.username.trim()) return user.username.trim();
        if (user.telegram_id !== undefined && user.telegram_id !== null)
          return `ID ${user.telegram_id}`;
        return 'Без имени';
      });
  }, [selectedCollection, enrichedUsers]);

  const directoriesToolbar = (() => {
    if (activeModule !== 'directories') {
      return null;
    }
    if (isUserSearchActive || isEmployeeSearchActive) {
      const isEmployee = isEmployeeSearchActive;
      const placeholder = isEmployee
        ? employeeSearchPlaceholder
        : userSearchPlaceholder;
      const addLabel = isEmployee ? employeeAddCta : userAddCta;
      const handleAdd = isEmployee
        ? () => openEmployeeModal()
        : () => openUserModal();
      return (
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <UiFormGroup
            className="sm:w-72"
            label={collectionSearchCta}
            htmlFor="settings-users-search"
            help={collectionSearchHint}
          >
            <UiInput
              id="settings-users-search"
              value={userSearchDraft}
              onChange={(event) => setUserSearchDraft(event.target.value)}
              onKeyDown={handleUserSearchKeyDown}
              placeholder={placeholder}
            />
          </UiFormGroup>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => submitUserSearch()}>
              {collectionSearchCta}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setUserSearchDraft('');
                submitUserSearch();
              }}
            >
              {collectionResetCta}
            </Button>
            <Button size="sm" variant="success" onClick={handleAdd}>
              {addLabel}
            </Button>
          </div>
        </div>
      );
    }
    if (isCollectionSearchSupported) {
      return (
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <UiFormGroup
            className="sm:w-72"
            label={collectionSearchCta}
            htmlFor="settings-collections-search"
            help={collectionSearchHint}
          >
            <UiInput
              id="settings-collections-search"
              value={currentSearchDraft}
              onChange={(event) =>
                updateCollectionSearchDraft(event.target.value)
              }
              onKeyDown={handleCollectionSearchKeyDown}
              placeholder={collectionSearchPlaceholder}
            />
          </UiFormGroup>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => submitCollectionSearch()}>
              {collectionSearchCta}
            </Button>
            <Button size="sm" variant="outline" onClick={resetCollectionSearch}>
              {collectionResetCta}
            </Button>
            <Button
              size="sm"
              variant="success"
              onClick={() => openCollectionModal()}
            >
              {collectionAddCta}
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="success"
          onClick={() => openCollectionModal()}
        >
          {collectionAddCta}
        </Button>
      </div>
    );
  })();

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-3 pb-12 pt-4 sm:px-4 lg:px-8">
      <Tabs
        value={activeModule}
        onValueChange={(value) =>
          handleModuleChange(value as SettingsModuleKey)
        }
        className="space-y-6"
      >
        <ActionBar
          breadcrumbs={<Breadcrumbs items={breadcrumbs} />}
          title={t('collections.page.title')}
          description={t('collections.page.description')}
          toolbar={directoriesToolbar}
        >
          <div className="flex flex-col gap-3">
            <div className="sm:hidden">
              <label htmlFor="settings-module-select" className="sr-only">
                {t('collections.moduleSelectLabel')}
              </label>
              <select
                id="settings-module-select"
                className="h-11 w-full rounded-2xl border border-[color:var(--color-gray-200)] bg-white px-3 text-sm font-semibold text-[color:var(--color-gray-800)] shadow-sm outline-none transition focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-200)] dark:border-[color:var(--color-gray-700)] dark:bg-[color:var(--color-gray-dark)] dark:text-white"
                value={activeModule}
                onChange={(event) =>
                  handleModuleChange(event.target.value as SettingsModuleKey)
                }
              >
                {moduleTabs.map((tab) => (
                  <option key={tab.key} value={tab.key}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </div>
            <TabsList className="hidden h-auto gap-2 bg-transparent p-0 sm:grid sm:gap-2 sm:p-1 sm:[grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr))] lg:[grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
              {moduleTabs.map((tab) => {
                const Icon = tab.icon;
                const labelId = `${tab.key}-module-tab-label`;
                return (
                  <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    aria-labelledby={labelId}
                    className="group flex h-full min-h-[3.1rem] w-full flex-col items-center justify-center gap-1 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-[color:var(--color-gray-700)] transition-colors duration-200 ease-out hover:bg-[color:var(--color-gray-50)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand-400)] focus-visible:ring-offset-2 dark:text-[color:var(--color-gray-200)] dark:hover:bg-[color:var(--color-gray-800)] data-[state=active]:border-[color:var(--color-gray-200)] data-[state=active]:bg-white data-[state=active]:text-[color:var(--color-brand-600)] data-[state=active]:shadow-sm dark:data-[state=active]:border-[color:var(--color-gray-700)] dark:data-[state=active]:bg-[color:var(--color-gray-dark)] dark:data-[state=active]:text-[color:var(--color-brand-300)]"
                  >
                    <Icon className="size-5 flex-shrink-0 text-[color:var(--color-gray-500)] transition-colors group-data-[state=active]:text-[color:var(--color-brand-600)] dark:text-[color:var(--color-gray-300)] dark:group-data-[state=active]:text-[color:var(--color-brand-300)] sm:size-6" />
                    <span
                      id={labelId}
                      className="truncate text-sm font-semibold leading-5 text-[color:var(--color-gray-800)] transition-colors group-data-[state=active]:text-[color:var(--color-brand-600)] dark:text-[color:var(--color-gray-100)] dark:group-data-[state=active]:text-[color:var(--color-brand-300)]"
                    >
                      {tab.label}
                    </span>
                    {tab.description ? (
                      <span className="hidden text-xs font-medium text-[color:var(--color-gray-500)] dark:text-[color:var(--color-gray-400)] md:block">
                        {tab.description}
                      </span>
                    ) : null}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </ActionBar>
        <TabsContent value="directories" className="mt-0 space-y-6">
          {hint ? (
            <div className="rounded-2xl border border-[color:var(--color-error-200)] bg-[color:var(--color-error-25)] p-4 text-sm text-[color:var(--color-error-600)] dark:border-[color:var(--color-error-700)] dark:bg-[color:var(--color-error-900)]/40 dark:text-[color:var(--color-error-200)]">
              {hint}
            </div>
          ) : null}
          <Tabs
            value={active}
            onValueChange={(value) => {
              setActive(value as CollectionKey);
              setPage(1);
            }}
            className="space-y-5"
          >
            <div className="sm:hidden">
              <label htmlFor="settings-section-select" className="sr-only">
                {t('collections.directorySelectLabel')}
              </label>
              <select
                id="settings-section-select"
                className="h-11 w-full rounded-2xl border border-[color:var(--color-gray-200)] bg-white px-3 text-sm font-semibold text-[color:var(--color-gray-800)] shadow-sm outline-none transition focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-200)] dark:border-[color:var(--color-gray-700)] dark:bg-[color:var(--color-gray-dark)] dark:text-white"
                value={active}
                onChange={(event) => {
                  setActive(event.target.value as CollectionKey);
                  setPage(1);
                }}
              >
                {types.map((type) => (
                  <option key={type.key} value={type.key}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <TabsList className="hidden gap-2 sm:grid sm:gap-2 sm:overflow-visible sm:p-1 sm:[grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr))] lg:[grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr))]">
              {types.map((type) => {
                const Icon = tabIcons[type.key as CollectionKey];
                const labelId = `${type.key}-tab-label`;
                return (
                  <TabsTrigger
                    key={type.key}
                    value={type.key}
                    aria-labelledby={labelId}
                    className="group flex h-full min-h-[3rem] w-full flex-col items-center justify-center gap-1 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-[color:var(--color-gray-700)] transition-colors duration-200 ease-out hover:bg-[color:var(--color-gray-50)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand-400)] focus-visible:ring-offset-2 dark:text-[color:var(--color-gray-200)] dark:hover:bg-[color:var(--color-gray-800)] data-[state=active]:border-[color:var(--color-gray-200)] data-[state=active]:bg-white data-[state=active]:text-[color:var(--color-brand-600)] data-[state=active]:shadow-sm dark:data-[state=active]:border-[color:var(--color-gray-700)] dark:data-[state=active]:bg-[color:var(--color-gray-dark)] dark:data-[state=active]:text-[color:var(--color-brand-300)]"
                  >
                    {Icon ? (
                      <Icon className="size-5 flex-shrink-0 text-[color:var(--color-gray-500)] transition-colors group-data-[state=active]:text-[color:var(--color-brand-600)] dark:text-[color:var(--color-gray-300)] dark:group-data-[state=active]:text-[color:var(--color-brand-300)] sm:size-6" />
                    ) : null}
                    <span
                      id={labelId}
                      className="truncate text-sm font-semibold leading-5 text-[color:var(--color-gray-800)] transition-colors group-data-[state=active]:text-[color:var(--color-brand-600)] dark:text-[color:var(--color-gray-100)] dark:group-data-[state=active]:text-[color:var(--color-brand-300)]"
                    >
                      {type.label}
                    </span>
                    {type.description ? (
                      <span
                        aria-hidden="true"
                        className="hidden text-xs font-medium text-[color:var(--color-gray-500)] dark:text-[color:var(--color-gray-400)] md:block"
                      >
                        {type.description}
                      </span>
                    ) : null}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {types.map((type) => {
              const isActiveTab = type.key === active;
              const rows: CollectionTableRow[] = isActiveTab
                ? items.map((item) => {
                    if (type.key === 'objects') {
                      const object = toCollectionObject(item);
                      return {
                        ...item,
                        address: object.address,
                        coordinates: formatCoordinates(
                          object.latitude,
                          object.longitude,
                        ),
                        displayValue: object.address || SETTINGS_BADGE_EMPTY,
                        metaSummary: formatMetaSummary(item.meta),
                      };
                    }
                    return {
                      ...item,
                      displayValue: getItemDisplayValue(
                        item,
                        type.key as CollectionKey,
                      ),
                      metaSummary: formatMetaSummary(item.meta),
                    };
                  })
                : [];
              const columnsForType =
                type.key === 'departments'
                  ? departmentColumns
                  : type.key === 'divisions'
                    ? divisionColumns
                    : type.key === 'positions'
                      ? positionColumns
                      : type.key === 'objects'
                        ? localizedObjectColumns
                        : type.key === 'fixed_assets'
                          ? fixedAssetColumns
                          : localizedCollectionColumns;

              const fixedAssetRows: FixedAssetRow[] =
                isActiveTab && type.key === 'fixed_assets'
                  ? items.map((item) => {
                      const meta = (item.meta ?? {}) as Record<string, unknown>;
                      const location =
                        meta.location && typeof meta.location === 'object'
                          ? (meta.location as Record<string, unknown>)
                          : undefined;
                      const locationSource =
                        location?.source === 'object' ? 'object' : 'manual';
                      const objectId =
                        typeof location?.objectId === 'string'
                          ? location.objectId
                          : '';
                      const objectName =
                        objectId && allObjects.length
                          ? allObjects.find((object) => object._id === objectId)
                              ?.name
                          : '';
                      const address =
                        typeof location?.address === 'string'
                          ? location.address
                          : '';
                      const latitude =
                        typeof location?.latitude === 'number'
                          ? location.latitude
                          : undefined;
                      const longitude =
                        typeof location?.longitude === 'number'
                          ? location.longitude
                          : undefined;
                      const locationLabel = (() => {
                        if (locationSource === 'object') {
                          if (objectName) return objectName;
                          return objectId ? `Объект ${objectId}` : '—';
                        }
                        if (address) return address;
                        if (latitude !== undefined || longitude !== undefined) {
                          return [
                            latitude?.toString() ?? '',
                            longitude?.toString() ?? '',
                          ]
                            .filter(Boolean)
                            .join(', ');
                        }
                        return '—';
                      })();
                      const description =
                        typeof meta.description === 'string'
                          ? meta.description
                          : '';
                      return {
                        _id: item._id,
                        name: item.name,
                        inventoryNumber: item.value,
                        location: locationLabel,
                        description: description || '—',
                      };
                    })
                  : [];

              if (type.key === 'users') {
                const showEmpty = paginatedUsers.length === 0;
                return (
                  <TabsContent
                    key={type.key}
                    value={type.key}
                    className="mt-0 flex flex-col gap-4"
                  >
                    {showEmpty ? (
                      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[color:var(--color-gray-200)] bg-white p-8 text-center shadow-sm dark:border-[color:var(--color-gray-700)] dark:bg-[color:var(--color-gray-dark)]">
                        <h3 className="text-lg font-semibold text-[color:var(--color-gray-800)] dark:text-white">
                          {collectionEmptyTitle}
                        </h3>
                        <p className="max-w-md text-sm text-[color:var(--color-gray-600)] dark:text-[color:var(--color-gray-300)]">
                          {collectionEmptyDescription}
                        </p>
                        <Button
                          variant="success"
                          onClick={() => openUserModal()}
                        >
                          {userAddCta}
                        </Button>
                      </div>
                    ) : (
                      <UiCard bodyClassName="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-semibold text-[color:var(--color-gray-800)] dark:text-white">
                            Пользователи
                          </h3>
                          <span className="badge badge-neutral badge-sm">
                            {paginatedUsers.length} записей
                          </span>
                        </div>
                        <div className="overflow-x-auto rounded-box border border-base-200">
                          <UiTable
                            className="table-zebra table-compact"
                            columns={userTableColumns}
                            rows={paginatedUsers}
                            rowKey={(row) =>
                              row._id ??
                              row.telegram_id ??
                              row.username ??
                              row.email ??
                              row.name
                            }
                            onRowClick={(row) => openUserModal(row)}
                            empty={SETTINGS_BADGE_EMPTY}
                          />
                        </div>
                        {renderPaginationControls(
                          userPage,
                          userTotalPages,
                          setUserPage,
                        )}
                      </UiCard>
                    )}
                  </TabsContent>
                );
              }

              if (type.key === 'employees') {
                const showEmpty = employeeRows.length === 0;
                return (
                  <TabsContent
                    key={type.key}
                    value={type.key}
                    className="mt-0 flex flex-col gap-4"
                  >
                    {showEmpty ? (
                      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[color:var(--color-gray-200)] bg-white p-8 text-center shadow-sm dark:border-[color:var(--color-gray-700)] dark:bg-[color:var(--color-gray-dark)]">
                        <h3 className="text-lg font-semibold text-[color:var(--color-gray-800)] dark:text-white">
                          {collectionEmptyTitle}
                        </h3>
                        <p className="max-w-md text-sm text-[color:var(--color-gray-600)] dark:text-[color:var(--color-gray-300)]">
                          {collectionEmptyDescription}
                        </p>
                        <Button
                          variant="success"
                          onClick={() => openEmployeeModal()}
                        >
                          {employeeAddCta}
                        </Button>
                      </div>
                    ) : (
                      <UiCard bodyClassName="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-semibold text-[color:var(--color-gray-800)] dark:text-white">
                            Сотрудники
                          </h3>
                          <span className="badge badge-neutral badge-sm">
                            {employeeRows.length} записей
                          </span>
                        </div>
                        <div className="overflow-x-auto rounded-box border border-base-200">
                          <UiTable
                            className="table-zebra table-compact"
                            columns={employeeTableColumns}
                            rows={employeeRows}
                            rowKey={(row) =>
                              row._id ??
                              row.telegram_id ??
                              row.username ??
                              row.email ??
                              row.name
                            }
                            onRowClick={(row) => openEmployeeModal(row)}
                            empty={SETTINGS_BADGE_EMPTY}
                          />
                        </div>
                        {renderPaginationControls(
                          userPage,
                          userTotalPages,
                          setUserPage,
                        )}
                      </UiCard>
                    )}
                  </TabsContent>
                );
              }

              if (type.key === 'tasks') {
                return (
                  <TabsContent key={type.key} value={type.key} className="mt-0">
                    <TaskSettingsTab
                      fields={taskFieldItems}
                      types={taskTypeItems}
                      loading={tasksLoading}
                      onSaveField={saveTaskField}
                      onDeleteField={deleteTaskField}
                      onSaveType={saveTaskType}
                      onDeleteType={deleteTaskType}
                    />
                  </TabsContent>
                );
              }

              if (type.key === 'fleets') {
                return (
                  <TabsContent key={type.key} value={type.key} className="mt-0">
                    <FleetVehiclesTab />
                  </TabsContent>
                );
              }

              const showEmpty =
                type.key === 'fixed_assets'
                  ? fixedAssetRows.length === 0
                  : rows.length === 0;
              return (
                <TabsContent
                  key={type.key}
                  value={type.key}
                  className="mt-0 flex flex-col gap-4"
                >
                  {isActiveTab && isLoading ? (
                    <div className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-[color:var(--color-gray-200)] bg-white shadow-sm dark:border-[color:var(--color-gray-700)] dark:bg-[color:var(--color-gray-dark)]">
                      <Spinner className="h-6 w-6 text-[color:var(--color-brand-500)]" />
                    </div>
                  ) : showEmpty ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[color:var(--color-gray-200)] bg-white p-8 text-center shadow-sm dark:border-[color:var(--color-gray-700)] dark:bg-[color:var(--color-gray-dark)]">
                      <h3 className="text-lg font-semibold text-[color:var(--color-gray-800)] dark:text-white">
                        {collectionEmptyTitle}
                      </h3>
                      <p className="max-w-md text-sm text-[color:var(--color-gray-600)] dark:text-[color:var(--color-gray-300)]">
                        {collectionEmptyDescription}
                      </p>
                      <Button
                        variant="success"
                        onClick={() => openCollectionModal()}
                      >
                        {collectionEmptyAction}
                      </Button>
                    </div>
                  ) : type.key === 'fixed_assets' ? (
                    <UiCard bodyClassName="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-[color:var(--color-gray-800)] dark:text-white">
                          Основные средства
                        </h3>
                        <span className="badge badge-neutral badge-sm">
                          {fixedAssetRows.length} записей
                        </span>
                      </div>
                      <div className="overflow-x-auto rounded-box border border-base-200">
                        <UiTable
                          className="table-zebra table-compact"
                          columns={fixedAssetTableColumns}
                          rows={fixedAssetRows}
                          rowKey={(row) => row._id}
                          onRowClick={(row) =>
                            openCollectionModal(
                              items.find((item) => item._id === row._id),
                            )
                          }
                          empty={SETTINGS_BADGE_EMPTY}
                        />
                      </div>
                      {renderPaginationControls(page, totalPages, setPage)}
                    </UiCard>
                  ) : (
                    <UiCard bodyClassName="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-[color:var(--color-gray-800)] dark:text-white">
                          {type.label}
                        </h3>
                        <span className="badge badge-neutral badge-sm">
                          {rows.length} записей
                        </span>
                      </div>
                      <div className="overflow-x-auto rounded-box border border-base-200">
                        <UiTable
                          className="table-zebra table-compact"
                          columns={
                            type.key === 'objects'
                              ? collectionObjectTableColumns
                              : collectionTableColumns
                          }
                          rows={rows}
                          rowKey={(row) => row._id}
                          onRowClick={(row) => openCollectionModal(row)}
                          empty={SETTINGS_BADGE_EMPTY}
                        />
                      </div>
                      {renderPaginationControls(page, totalPages, setPage)}
                    </UiCard>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </TabsContent>
        <Modal open={collectionModalOpen} onClose={closeCollectionModal}>
          <div className="space-y-4">
            {selectedCollection ? (
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                {selectedCollection.type === 'departments' ? (
                  <>
                    <h3 className="text-base font-semibold">
                      Информация о департаменте
                    </h3>
                    <dl className="mt-2 space-y-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="font-medium text-slate-500">ID</dt>
                        <dd className="text-right text-slate-900">
                          {selectedCollection._id}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="font-medium text-slate-500">Название</dt>
                        <dd className="text-right text-slate-900">
                          {selectedCollection.name}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">
                          Отделы департамента
                        </dt>
                        <dd className="mt-2">
                          {renderBadgeList(selectedDepartmentDivisionNames)}
                        </dd>
                      </div>
                    </dl>
                  </>
                ) : selectedCollection.type === 'divisions' ? (
                  <>
                    <h3 className="text-base font-semibold">
                      Информация о департаменте
                    </h3>
                    <dl className="mt-2 space-y-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="font-medium text-slate-500">ID</dt>
                        <dd className="text-right text-slate-900">
                          {selectedCollection._id}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="font-medium text-slate-500">Название</dt>
                        <dd className="text-right text-slate-900">
                          {selectedCollection.name}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="font-medium text-slate-500">
                          Департамент
                        </dt>
                        <dd className="text-right text-slate-900">
                          {selectedDivisionDepartmentName || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">
                          Должности отдела
                        </dt>
                        <dd className="mt-2">
                          {renderBadgeList(selectedDivisionPositionNames)}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">
                          Сотрудники отдела
                        </dt>
                        <dd className="mt-2">
                          {renderBadgeList(selectedDivisionEmployeeNames)}
                        </dd>
                      </div>
                    </dl>
                  </>
                ) : selectedCollection.type === 'objects' &&
                  selectedObjectDetails ? (
                  <>
                    <h3 className="text-base font-semibold">
                      Информация об объекте
                    </h3>
                    <dl className="mt-2 space-y-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="font-medium text-slate-500">ID</dt>
                        <dd className="text-right text-slate-900">
                          {selectedCollection._id}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="font-medium text-slate-500">Название</dt>
                        <dd className="text-right text-slate-900">
                          {selectedCollection.name}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="font-medium text-slate-500">Адрес</dt>
                        <dd className="text-right text-slate-900">
                          {selectedObjectDetails.address || '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="font-medium text-slate-500">
                          Координаты
                        </dt>
                        <dd className="text-right text-slate-900">
                          {formatCoordinates(
                            selectedObjectDetails.latitude,
                            selectedObjectDetails.longitude,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">Meta</dt>
                        <dd className="mt-1">
                          <pre className="max-h-48 overflow-auto rounded bg-white p-2 text-xs text-slate-800">
                            {selectedCollection.meta
                              ? JSON.stringify(selectedCollection.meta, null, 2)
                              : '{}'}
                          </pre>
                        </dd>
                      </div>
                    </dl>
                  </>
                ) : selectedCollection.type === 'fixed_assets' ? (
                  <>
                    <h3 className="text-base font-semibold">
                      Карточка основного средства
                    </h3>
                    <dl className="mt-2 space-y-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="font-medium text-slate-500">ID</dt>
                        <dd className="text-right text-slate-900">
                          {selectedCollection._id}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="font-medium text-slate-500">Название</dt>
                        <dd className="text-right text-slate-900">
                          {selectedCollection.name}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="font-medium text-slate-500">
                          Инвентарный номер
                        </dt>
                        <dd className="text-right text-slate-900">
                          {selectedCollection.value || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">Описание</dt>
                        <dd className="mt-1 rounded bg-white p-2 text-xs text-slate-900">
                          {typeof selectedCollection.meta?.description ===
                          'string'
                            ? selectedCollection.meta.description
                            : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">
                          Расположение
                        </dt>
                        <dd className="mt-1 rounded bg-white p-2 text-xs text-slate-900">
                          {(() => {
                            const meta = selectedCollection.meta as
                              | Record<string, unknown>
                              | undefined;
                            const location =
                              meta?.location &&
                              typeof meta.location === 'object'
                                ? (meta.location as Record<string, unknown>)
                                : undefined;
                            const source =
                              location?.source === 'object'
                                ? 'object'
                                : 'manual';
                            const objectId =
                              typeof location?.objectId === 'string'
                                ? location.objectId
                                : '';
                            if (source === 'object') {
                              const objectName =
                                objectId && allObjects.length
                                  ? allObjects.find(
                                      (object) => object._id === objectId,
                                    )?.name
                                  : '';
                              return objectName || objectId || '—';
                            }
                            const address =
                              typeof location?.address === 'string'
                                ? location.address
                                : '';
                            if (address) return address;
                            const latitude =
                              typeof location?.latitude === 'number'
                                ? location.latitude
                                : undefined;
                            const longitude =
                              typeof location?.longitude === 'number'
                                ? location.longitude
                                : undefined;
                            if (
                              latitude !== undefined ||
                              longitude !== undefined
                            ) {
                              return `${latitude ?? ''} ${longitude ?? ''}`.trim();
                            }
                            return '—';
                          })()}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">
                          История событий
                        </dt>
                        <dd className="mt-1 text-xs text-slate-500">
                          Привязанные события будут отображаться после
                          наполнения журнала событий.
                        </dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <>
                    <h3 className="text-base font-semibold">
                      Карточка элемента
                    </h3>
                    <dl className="mt-2 space-y-1 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="font-medium text-slate-500">ID</dt>
                        <dd className="text-right text-slate-900">
                          {selectedCollection._id}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="font-medium text-slate-500">Название</dt>
                        <dd className="text-right text-slate-900">
                          {selectedCollection.name}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="font-medium text-slate-500">Тип</dt>
                        <dd className="text-right text-slate-900">
                          {selectedCollection.type}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">Значение</dt>
                        <dd className="mt-1 rounded bg-white p-2 font-mono text-xs text-slate-900">
                          {selectedCollection.value || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">Meta</dt>
                        <dd className="mt-1">
                          <pre className="max-h-48 overflow-auto rounded bg-white p-2 text-xs text-slate-800">
                            {selectedCollection.meta
                              ? JSON.stringify(selectedCollection.meta, null, 2)
                              : '{}'}
                          </pre>
                        </dd>
                      </div>
                    </dl>
                  </>
                )}
              </article>
            ) : null}
            <CollectionForm
              form={form}
              onChange={setForm}
              onSubmit={submit}
              onDelete={remove}
              onReset={() => setForm(emptyItemForm)}
              valueLabel={
                active === 'departments'
                  ? 'Отделы'
                  : active === 'divisions'
                    ? 'Департамент'
                    : active === 'positions'
                      ? 'Отдел'
                      : active === 'objects'
                        ? 'Адрес'
                        : active === 'fixed_assets'
                          ? 'Инвентарный номер'
                          : undefined
              }
              renderValueField={
                active === 'departments'
                  ? renderDepartmentValueField
                  : active === 'divisions'
                    ? renderDivisionValueField
                    : active === 'positions'
                      ? renderPositionValueField
                      : active === 'objects'
                        ? renderObjectValueField
                        : active === 'fixed_assets'
                          ? renderFixedAssetValueField
                          : undefined
              }
              readonly={selectedCollectionInfo.readonly}
              readonlyNotice={selectedCollectionInfo.notice}
            />
          </div>
        </Modal>
        <Modal open={userModalOpen} onClose={closeUserModal}>
          <div className="space-y-4">
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <header className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">
                    Карточка пользователя
                  </h3>
                  <p className="text-sm text-slate-500">
                    Telegram ID: {userForm.telegram_id ?? '—'}
                  </p>
                </div>
                {canManageUsers && userForm.telegram_id ? (
                  <Button
                    type="button"
                    variant="destructive"
                    className="h-9 px-3 text-sm"
                    onClick={() => setConfirmUserDelete(true)}
                  >
                    Удалить
                  </Button>
                ) : null}
              </header>
              <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-slate-500">Логин</dt>
                  <dd className="text-slate-900">{userForm.username || '—'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Имя</dt>
                  <dd className="text-slate-900">{userForm.name || '—'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Телефон</dt>
                  <dd className="text-slate-900">{userForm.phone || '—'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Мобильный</dt>
                  <dd className="text-slate-900">
                    {userForm.mobNumber || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Email</dt>
                  <dd className="text-slate-900">{userForm.email || '—'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Роль</dt>
                  <dd className="text-slate-900">
                    {formatRoleName(userForm.role)}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Доступ</dt>
                  <dd className="text-slate-900">{userForm.access}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Роль ID</dt>
                  <dd className="text-slate-900">
                    {userForm.roleId
                      ? formatRoleName(
                          roleMap.get(userForm.roleId) ?? userForm.roleId,
                        )
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Департамент</dt>
                  <dd className="text-slate-900">
                    {userForm.departmentId
                      ? (departmentMap.get(userForm.departmentId) ??
                        userForm.departmentId)
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Отдел</dt>
                  <dd className="text-slate-900">
                    {userForm.divisionId
                      ? (divisionMap.get(userForm.divisionId) ??
                        userForm.divisionId)
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Должность</dt>
                  <dd className="text-slate-900">
                    {userForm.positionId
                      ? (positionMap.get(userForm.positionId) ??
                        userForm.positionId)
                      : '—'}
                  </dd>
                </div>
              </dl>
            </article>
            <UserForm
              form={userForm}
              onChange={setUserForm}
              onSubmit={submitUser}
              onReset={() => setUserForm(emptyUser)}
            />
          </div>
        </Modal>
        <Modal
          open={isEmployeeModalOpen}
          onClose={() => setIsEmployeeModalOpen(false)}
        >
          <div className="space-y-4">
            {selectedEmployee ? (
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">
                      Карточка сотрудника
                    </h3>
                    <p className="text-sm text-slate-500">
                      ID: {selectedEmployee.telegram_id ?? '—'}
                    </p>
                  </div>
                  {canManageUsers && selectedEmployee.telegram_id ? (
                    <Button
                      type="button"
                      variant="destructive"
                      className="h-9 px-3 text-sm"
                      onClick={() => setConfirmEmployeeDelete(true)}
                    >
                      Удалить
                    </Button>
                  ) : null}
                </header>
                <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-slate-500">Telegram ID</dt>
                    <dd className="text-slate-900">
                      {selectedEmployee.telegram_id}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Логин</dt>
                    <dd className="text-slate-900">
                      {selectedEmployee.username || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Имя</dt>
                    <dd className="text-slate-900">
                      {selectedEmployee.name || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Телефон</dt>
                    <dd className="text-slate-900">
                      {selectedEmployee.phone || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Мобильный</dt>
                    <dd className="text-slate-900">
                      {selectedEmployee.mobNumber || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Email</dt>
                    <dd className="text-slate-900">
                      {selectedEmployee.email || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Роль</dt>
                    <dd className="text-slate-900">
                      {formatRoleName(selectedEmployee.role)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Доступ</dt>
                    <dd className="text-slate-900">
                      {selectedEmployee.access ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Роль ID</dt>
                    <dd className="text-slate-900">
                      {selectedEmployee.roleId
                        ? formatRoleName(
                            roleMap.get(selectedEmployee.roleId) ??
                              selectedEmployee.roleId,
                          )
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Департамент</dt>
                    <dd className="text-slate-900">
                      {selectedEmployee.departmentId
                        ? (departmentMap.get(selectedEmployee.departmentId) ??
                          selectedEmployee.departmentId)
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Отдел</dt>
                    <dd className="text-slate-900">
                      {selectedEmployee.divisionId
                        ? (divisionMap.get(selectedEmployee.divisionId) ??
                          selectedEmployee.divisionId)
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Должность</dt>
                    <dd className="text-slate-900">
                      {selectedEmployee.positionId
                        ? (positionMap.get(selectedEmployee.positionId) ??
                          selectedEmployee.positionId)
                        : '—'}
                    </dd>
                  </div>
                </dl>
              </article>
            ) : null}
            <EmployeeCardForm
              telegramId={
                employeeFormMode === 'update' ? selectedEmployeeId : undefined
              }
              mode={employeeFormMode}
              onSaved={handleEmployeeSaved}
            />
          </div>
        </Modal>
        <ConfirmDialog
          open={confirmUserDelete}
          message="Удалить пользователя? Это действие нельзя отменить."
          onConfirm={executeUserDelete}
          onCancel={() => setConfirmUserDelete(false)}
          confirmText="Удалить"
        />
        <ConfirmDialog
          open={confirmEmployeeDelete}
          message="Удалить сотрудника? Это действие нельзя отменить."
          onConfirm={executeEmployeeDelete}
          onCancel={() => setConfirmEmployeeDelete(false)}
          confirmText="Удалить"
        />
        <TabsContent value="reports" className="mt-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <AnalyticsDashboard />
          </div>
        </TabsContent>
        <TabsContent value="archive" className="mt-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <ArchivePage />
          </div>
        </TabsContent>
        <TabsContent value="logs" className="mt-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <LogsPage />
          </div>
        </TabsContent>
        <TabsContent value="storage" className="mt-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <StoragePage />
          </div>
        </TabsContent>
        <TabsContent value="health" className="mt-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <HealthCheckTab />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
