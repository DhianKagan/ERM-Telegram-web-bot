// Назначение: страница управления коллекциями настроек
// Основные модули: React, Tabs, services/collections
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../components/Tabs";
import DataTable from "../../components/DataTable";
import {
  fetchCollectionItems,
  fetchAllCollectionItems,
  createCollectionItem,
  updateCollectionItem,
  removeCollectionItem,
  CollectionItem,
} from "../../services/collections";
import CollectionForm from "./CollectionForm";
import ConfirmDialog from "../../components/ConfirmDialog";
import EmployeeCardForm from "../../components/EmployeeCardForm";
import Modal from "../../components/Modal";
import FleetVehiclesTab from "./FleetVehiclesTab";
import TaskSettingsTab from "./TaskSettingsTab";
import {
  collectionColumns,
  type CollectionTableRow,
} from "../../columns/collectionColumns";
import { settingsUserColumns } from "../../columns/settingsUserColumns";
import {
  settingsEmployeeColumns,
  type EmployeeRow,
} from "../../columns/settingsEmployeeColumns";
import {
  fetchUsers,
  createUser as createUserApi,
  updateUser as updateUserApi,
  deleteUser as deleteUserApi,
  type UserDetails,
} from "../../services/users";
import { fetchRoles, type Role } from "../../services/roles";
import { formatRoleName } from "../../utils/roleDisplay";
import UserForm, { UserFormData } from "./UserForm";
import type { User } from "../../types/user";
import { useAuth } from "../../context/useAuth";
import {
  SETTINGS_BADGE_CLASS,
  SETTINGS_BADGE_EMPTY,
  SETTINGS_BADGE_WRAPPER_CLASS,
} from "./badgeStyles";
import { hasAccess, ACCESS_ADMIN } from "../../utils/access";
import { showToast } from "../../utils/toast";
import {
  BuildingOffice2Icon,
  Squares2X2Icon,
  IdentificationIcon,
  UserGroupIcon,
  TruckIcon,
  KeyIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";

const types = [
  {
    key: "departments",
    label: "Департамент",
    description: "Структура компании и направления",
  },
  {
    key: "divisions",
    label: "Отдел",
    description: "Команды внутри департаментов",
  },
  {
    key: "positions",
    label: "Должность",
    description: "Роли и рабочие позиции",
  },
  {
    key: "employees",
    label: "Сотрудник",
    description: "Карточки и доступы сотрудников",
  },
  {
    key: "fleets",
    label: "Автопарк",
    description: "Транспорт и связанный состав",
  },
  {
    key: "users",
    label: "Пользователь",
    description: "Учётные записи в системе",
  },
  {
    key: "tasks",
    label: "Задачи",
    description: "Поля формы и темы публикаций",
  },
] as const;

type CollectionKey = (typeof types)[number]["key"];

const createInitialQueries = (): Record<CollectionKey, string> =>
  types.reduce(
    (acc, type) => {
      acc[type.key as CollectionKey] = "";
      return acc;
    },
    {} as Record<CollectionKey, string>,
  );

const emptyUser: UserFormData = {
  telegram_id: undefined,
  username: "",
  name: "",
  phone: "",
  mobNumber: "",
  email: "",
  role: "user",
  access: 1,
  roleId: "",
  departmentId: "",
  divisionId: "",
  positionId: "",
};

const tabIcons: Record<
  CollectionKey,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  departments: BuildingOffice2Icon,
  divisions: Squares2X2Icon,
  positions: IdentificationIcon,
  employees: UserGroupIcon,
  fleets: TruckIcon,
  users: KeyIcon,
  tasks: ClipboardDocumentListIcon,
};

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

interface ItemForm {
  _id?: string;
  name: string;
  value: string;
}

const normalizeId = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withoutQuotes = trimmed.replace(/^['"]+|['"]+$/g, "");
  const withoutBrackets = withoutQuotes.replace(/^\[+|\]+$/g, "");
  const withoutBraces = withoutBrackets.replace(/^[{}]+|[{}]+$/g, "");
  const withoutTrailingComma = withoutBraces.replace(/,+$/g, "");
  return withoutTrailingComma.trim();
};

const collectStringIds = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStringIds);
  }
  if (value && typeof value === "object") {
    const result: string[] = [];
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      if (Array.isArray(entry) || (entry && typeof entry === "object")) {
        result.push(...collectStringIds(entry));
        return;
      }
      if (typeof entry === "string") {
        const trimmed = entry.trim();
        if (!trimmed) return;
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes("id") || !/\s/.test(trimmed)) {
          result.push(trimmed);
        }
        return;
      }
      if (typeof entry === "boolean" || typeof entry === "number") {
        if (entry) {
          result.push(key);
        }
      }
    });
    return result;
  }
  return [];
};

const parseIds = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return [] as string[];
  const shouldParseJson = trimmed.startsWith("[") || trimmed.startsWith("{");
  if (shouldParseJson) {
    try {
      const parsed = JSON.parse(trimmed);
      const extracted = collectStringIds(parsed)
        .map(normalizeId)
        .filter(Boolean);
      if (extracted.length) {
        return Array.from(new Set(extracted));
      }
    } catch {
      // игнорируем ошибки парсинга и переходим к разбору по разделителю
    }
  }
  const splitted = trimmed
    .split(",")
    .map(normalizeId)
    .filter(Boolean);
  return Array.from(new Set(splitted));
};

const normalizeEmployeeValue = (
  value: unknown,
): Partial<EmployeeRow> & { telegram_id?: number } => {
  const record: Partial<EmployeeRow> & { telegram_id?: number } = {};
  const assignString = (
    key: keyof EmployeeRow,
    raw: unknown,
  ) => {
    if (raw === undefined || raw === null) return;
    const str = String(raw).trim();
    if (!str) return;
    record[key] = str as unknown as EmployeeRow[typeof key];
  };
  const assignNumber = (key: keyof EmployeeRow, raw: unknown) => {
    if (raw === undefined || raw === null) return;
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    record[key] = num as unknown as EmployeeRow[typeof key];
  };
  const assignTelegramId = (raw: unknown) => {
    if (raw === undefined || raw === null) return;
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    record.telegram_id = num;
  };
  const assignFromKey = (key: string, raw: unknown) => {
    const lower = key.toLowerCase();
    switch (lower) {
      case "telegram_id":
      case "telegramid":
      case "id":
        assignTelegramId(raw);
        break;
      case "telegram_username":
      case "telegramusername":
      case "username":
      case "login":
        assignString("telegram_username", raw);
        assignString("username", raw);
        break;
      case "name":
      case "full_name":
      case "fullname":
        assignString("name", raw);
        break;
      case "phone":
      case "tel":
      case "telephone":
        assignString("phone", raw);
        break;
      case "mobnumber":
      case "mobile":
      case "mobile_phone":
      case "mobilephone":
      case "mob_number":
        assignString("mobNumber", raw);
        break;
      case "email":
        assignString("email", raw);
        break;
      case "role":
        assignString("role", raw);
        break;
      case "access":
        assignNumber("access", raw);
        break;
      case "roleid":
      case "role_id":
        assignString("roleId", raw);
        break;
      case "rolename":
      case "role_name":
        assignString("roleName", raw);
        break;
      case "departmentid":
      case "department_id":
        assignString("departmentId", raw);
        break;
      case "departmentname":
      case "department_name":
      case "department":
        assignString("departmentName", raw);
        break;
      case "divisionid":
      case "division_id":
        assignString("divisionId", raw);
        break;
      case "divisionname":
      case "division_name":
      case "division":
        assignString("divisionName", raw);
        break;
      case "positionid":
      case "position_id":
        assignString("positionId", raw);
        break;
      case "positionname":
      case "position_name":
      case "position":
        assignString("positionName", raw);
        break;
      default:
        break;
    }
  };

  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        assignFromKey(key, (raw as { value?: unknown }).value ?? raw);
        return;
      }
      assignFromKey(key, raw);
    });
    return record;
  }

  assignFromKey("value", value);
  return record;
};

const parseEmployeeValue = (value: string): (Partial<EmployeeRow> & {
  telegram_id?: number;
}) => {
  const trimmed = value.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => normalizeEmployeeValue(item))
          .reduce((acc, item) => ({ ...acc, ...item }), {} as Partial<EmployeeRow> & {
            telegram_id?: number;
          });
      }
      return normalizeEmployeeValue(parsed);
    } catch {
      // игнорируем ошибки парсинга и пытаемся разобрать строку вручную
    }
  }

  const result: Record<string, string> = {};
  trimmed
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const [rawKey, ...rest] = part.split(":");
      if (!rawKey || !rest.length) return;
      result[rawKey.trim()] = rest.join(":").trim();
    });
  if (Object.keys(result).length) {
    return normalizeEmployeeValue(result);
  }
  return {};
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
    if (typeof index === "number") {
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
    typeof fallbackName === "string" && fallbackName.trim().length
      ? fallbackName.trim()
      : "";
  if (directName) return directName;
  if (typeof id !== "string") return "";
  const trimmed = id.trim();
  if (!trimmed) return "";
  return map.get(trimmed) ?? trimmed;
};

const USERS_ERROR_HINT = "Не удалось загрузить пользователей";
const DUPLICATE_DIVISION_HINT_PREFIX = "Обнаружены дублирующиеся отделы";
const TASK_SETTINGS_ERROR_HINT = "Не удалось загрузить настройки задач";
const TASK_FIELD_SAVE_ERROR = "Не удалось сохранить поле задачи";
const TASK_TYPE_SAVE_ERROR = "Не удалось сохранить тип задачи";
const TASK_SETTINGS_RESET_ERROR = "Не удалось сбросить настройки задач";
const USER_DELETE_SUCCESS = "Пользователь удалён";
const USER_DELETE_ERROR = "Не удалось удалить пользователя";
const EMPLOYEE_DELETE_SUCCESS = "Сотрудник удалён";
const EMPLOYEE_DELETE_ERROR = "Не удалось удалить сотрудника";

type CollectionColumn = (typeof collectionColumns)[number];

const hasAccessorKey = (
  column: CollectionColumn,
): column is CollectionColumn & { accessorKey: string } =>
  typeof (column as { accessorKey?: unknown }).accessorKey === "string";

export default function CollectionsPage() {
  const [active, setActive] = useState<CollectionKey>("departments");
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [queries, setQueries] = useState<Record<CollectionKey, string>>(() =>
    createInitialQueries(),
  );
  const [searchDrafts, setSearchDrafts] = useState<Record<CollectionKey, string>>(
    () => createInitialQueries(),
  );
  const [form, setForm] = useState<ItemForm>({ name: "", value: "" });
  const [hint, setHint] = useState("");
  const [allDepartments, setAllDepartments] = useState<CollectionItem[]>([]);
  const [allDivisions, setAllDivisions] = useState<CollectionItem[]>([]);
  const [allPositions, setAllPositions] = useState<CollectionItem[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const limit = 10;
  const [users, setUsers] = useState<User[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [userQuery, setUserQuery] = useState("");
  const [userSearchDraft, setUserSearchDraft] = useState("");
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState<UserFormData>(emptyUser);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<
    CollectionItem | null
  >(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<
    string | undefined
  >(undefined);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [employeeFormMode, setEmployeeFormMode] = useState<"create" | "update">(
    "create",
  );
  const [taskFieldItems, setTaskFieldItems] = useState<CollectionItem[]>([]);
  const [taskTypeItems, setTaskTypeItems] = useState<CollectionItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const { user: currentUser } = useAuth();
  const [confirmUserDelete, setConfirmUserDelete] = useState(false);
  const [confirmEmployeeDelete, setConfirmEmployeeDelete] = useState(false);
  const canManageUsers = hasAccess(currentUser?.access, ACCESS_ADMIN);
  const actionButtonClass =
    "h-10 w-full max-w-[11rem] px-3 text-sm font-semibold sm:w-auto lg:h-8 lg:text-xs";
  const selectedCollectionInfo = useMemo(() => {
    if (!selectedCollection?.meta || typeof selectedCollection.meta !== "object") {
      return { readonly: false, notice: undefined as string | undefined };
    }
    const meta = selectedCollection.meta as {
      readonly?: unknown;
      legacy?: unknown;
      readonlyReason?: unknown;
    };
    const readonly = Boolean(meta.readonly ?? meta.legacy);
    const notice = readonly
      ? typeof meta.readonlyReason === "string"
        ? meta.readonlyReason
        : meta.legacy
          ? "Элемент перенесён из старой коллекции и доступен только для чтения."
          : undefined
      : undefined;
    return { readonly, notice };
  }, [selectedCollection]);

  const currentQuery = queries[active] ?? "";
  const currentSearchDraft = searchDrafts[active] ?? "";

  useEffect(() => {
    setSearchDrafts((prev) => ({ ...prev, [active]: currentQuery }));
  }, [active, currentQuery]);

  const load = useCallback(async () => {
    if (active === "users" || active === "tasks") return;
    if (active === "fleets") {
      setItems([]);
      setTotal(0);
      setHint("");
      return;
    }
    try {
      const d = (await fetchCollectionItems(
        active,
        currentQuery,
        page,
        limit,
      )) as { items: CollectionItem[]; total: number };
      setItems(d.items);
      setTotal(d.total);
      if (active === "departments") {
        setAllDepartments((prev) => mergeById(prev, d.items));
      }
      if (active === "divisions") {
        setAllDivisions((prev) => mergeById(prev, d.items));
      }
      if (active === "positions") {
        setAllPositions((prev) => mergeById(prev, d.items));
      }
      setHint("");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось загрузить элементы";
      setItems([]);
      setTotal(0);
      setHint(message);
    }
  }, [active, currentQuery, page]);

  const loadUsers = useCallback(async () => {
    try {
      const list = await fetchUsers();
      setUsers(list);
      setHint((prev) => (prev === USERS_ERROR_HINT ? "" : prev));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : USERS_ERROR_HINT;
      setUsers([]);
      setHint(message || USERS_ERROR_HINT);
    }
  }, []);

  const loadTaskSettings = useCallback(async () => {
    setTasksLoading(true);
    try {
      const [fields, types] = await Promise.all([
        fetchAllCollectionItems("task_fields"),
        fetchAllCollectionItems("task_types"),
      ]);
      setTaskFieldItems(fields);
      setTaskTypeItems(types);
      setHint((prev) => (prev === TASK_SETTINGS_ERROR_HINT ? "" : prev));
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
    if (active === "tasks") {
      void loadTaskSettings();
    }
  }, [active, loadTaskSettings]);

  const saveTaskField = useCallback(
    async (item: CollectionItem, label: string) => {
      const trimmed = label.trim();
      if (!trimmed) {
        throw new Error("Название не может быть пустым");
      }
      try {
        if (item.meta?.virtual) {
          await createCollectionItem("task_fields", {
            name: item.name,
            value: trimmed,
          });
        } else {
          await updateCollectionItem(
            item._id,
            { name: item.name, value: trimmed },
            { collectionType: "task_fields" },
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

  const resetTaskField = useCallback(
    async (item: CollectionItem) => {
      if (item.meta?.virtual) {
        return;
      }
      try {
        await removeCollectionItem(item._id);
        await loadTaskSettings();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : TASK_SETTINGS_RESET_ERROR;
        throw new Error(message || TASK_SETTINGS_RESET_ERROR);
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
        throw new Error("Название не может быть пустым");
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
          await createCollectionItem("task_types", {
            name: item.name,
            value: trimmedLabel,
            ...(Object.keys(meta).length ? { meta } : {}),
          });
        } else {
          const meta = buildMeta();
          if (!trimmedUrl) {
            meta.tg_theme_url = "";
          }
          if (!trimmedPhotosUrl) {
            meta.tg_photos_url = "";
          }
          await updateCollectionItem(
            item._id,
            {
              name: item.name,
              value: trimmedLabel,
              meta,
            },
            { collectionType: "task_types" },
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

  const resetTaskType = useCallback(
    async (item: CollectionItem) => {
      if (item.meta?.virtual) {
        return;
      }
      try {
        await removeCollectionItem(item._id);
        await loadTaskSettings();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : TASK_SETTINGS_RESET_ERROR;
        throw new Error(message || TASK_SETTINGS_RESET_ERROR);
      }
    },
    [loadTaskSettings],
  );

  useEffect(() => {
    if (active === "users" || active === "employees") {
      setUserSearchDraft(userQuery);
    }
  }, [active, userQuery]);

  useEffect(() => {
    if (collectionModalOpen && selectedCollection?.type === "divisions") {
      void loadUsers();
    }
  }, [collectionModalOpen, selectedCollection, loadUsers]);

  useEffect(() => {
    const loadReferenceCollections = async () => {
      const [departmentsResult, divisionsResult, positionsResult] =
        await Promise.allSettled([
          fetchAllCollectionItems("departments"),
          fetchAllCollectionItems("divisions"),
          fetchAllCollectionItems("positions"),
        ]);

      const applyResult = (
        result: PromiseSettledResult<CollectionItem[]>,
        setter: React.Dispatch<React.SetStateAction<CollectionItem[]>>,
        fallbackMessage: string,
      ) => {
        if (result.status === "fulfilled") {
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
        "Не удалось загрузить департаменты",
      );
      applyResult(
        divisionsResult,
        setAllDivisions,
        "Не удалось загрузить отделы",
      );
      applyResult(
        positionsResult,
        setAllPositions,
        "Не удалось загрузить должности",
      );
    };

    void loadReferenceCollections();
    fetchRoles()
      .then((list) => setAllRoles(list))
      .catch((error) => {
        setAllRoles([]);
        const message =
          error instanceof Error
            ? error.message
            : "Не удалось загрузить роли";
        setHint((prev) => prev || message);
      });
  }, []);

  useEffect(() => {
    if (active !== "users" && active !== "tasks") {
      void load();
      if (active !== "fleets") {
        setForm({ name: "", value: "" });
      }
    } else {
      setHint("");
    }
  }, [load, active]);

  useEffect(() => {
    if (active === "users") {
      void loadUsers();
      setUserForm(emptyUser);
      setSelectedEmployeeId(undefined);
    }
    if (active === "employees") {
      void loadUsers();
      setSelectedEmployeeId(undefined);
      setEmployeeFormMode("create");
      setIsEmployeeModalOpen(false);
    }
    if (active !== "employees") {
      setIsEmployeeModalOpen(false);
    }
    if (
      active === "users" ||
      active === "employees" ||
      active === "fleets" ||
      active === "tasks"
    ) {
      setCollectionModalOpen(false);
    }
    if (active !== "users") {
      setUserModalOpen(false);
      setUserForm(emptyUser);
    }
  }, [active, loadUsers]);

  const openCollectionModal = (item?: CollectionItem) => {
    if (item) {
      setForm({ _id: item._id, name: item.name, value: item.value });
      setSelectedCollection(item);
    } else {
      setForm({ name: "", value: "" });
      setSelectedCollection(null);
    }
    setCollectionModalOpen(true);
  };

  const closeCollectionModal = () => {
    setCollectionModalOpen(false);
    setSelectedCollection(null);
    setForm({ name: "", value: "" });
  };

  const mapUserToForm = (user?: User): UserFormData => ({
    telegram_id: user?.telegram_id,
    username: user?.telegram_username ?? user?.username ?? "",
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    mobNumber: user?.mobNumber ?? "",
    email: user?.email ?? "",
    role: user?.role ?? "user",
    access: user?.access ?? 1,
    roleId: user?.roleId ?? "",
    departmentId: user?.departmentId ?? "",
    divisionId: user?.divisionId ?? "",
    positionId: user?.positionId ?? "",
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
      setEmployeeFormMode("update");
    } else {
      setSelectedEmployeeId(undefined);
      setEmployeeFormMode("create");
    }
    setIsEmployeeModalOpen(true);
  };

  const updateCollectionSearchDraft = (value: string) => {
    setSearchDrafts((prev) => ({ ...prev, [active]: value }));
  };

  const submitCollectionSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    const text = (searchDrafts[active] ?? "").trim();
    setQueries((prev) => ({ ...prev, [active]: text }));
  };

  const submitUserSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setUserPage(1);
    setUserQuery(userSearchDraft.trim());
    setSelectedEmployeeId(undefined);
  };

  const handleEmployeeSaved = (updated: UserDetails) => {
    void loadUsers();
    if (updated.telegram_id !== undefined) {
      setSelectedEmployeeId(String(updated.telegram_id));
      setEmployeeFormMode("update");
    }
  };

  const executeUserDelete = useCallback(async () => {
    if (!userForm.telegram_id) {
      setConfirmUserDelete(false);
      return;
    }
    try {
      await deleteUserApi(userForm.telegram_id);
      showToast(USER_DELETE_SUCCESS, "success");
      setSelectedEmployeeId((prev) =>
        prev === String(userForm.telegram_id) ? undefined : prev,
      );
      closeUserModal();
      await loadUsers();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : USER_DELETE_ERROR;
      showToast(message || USER_DELETE_ERROR, "error");
    } finally {
      setConfirmUserDelete(false);
    }
  }, [
    userForm.telegram_id,
    closeUserModal,
    loadUsers,
    setSelectedEmployeeId,
  ]);

  const executeEmployeeDelete = useCallback(async () => {
    if (!selectedEmployeeId) {
      setConfirmEmployeeDelete(false);
      return;
    }
    try {
      await deleteUserApi(selectedEmployeeId);
      showToast(EMPLOYEE_DELETE_SUCCESS, "success");
      setIsEmployeeModalOpen(false);
      setSelectedEmployeeId(undefined);
      setEmployeeFormMode("create");
      await loadUsers();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : EMPLOYEE_DELETE_ERROR;
      showToast(message || EMPLOYEE_DELETE_ERROR, "error");
    } finally {
      setConfirmEmployeeDelete(false);
    }
  }, [
    selectedEmployeeId,
    loadUsers,
  ]);

  const submit = async () => {
    if (active === "fleets") return;
    const trimmedName = form.name.trim();
    if (!trimmedName) return;
    if (form._id && selectedCollectionInfo.readonly) {
      setHint(
        selectedCollectionInfo.notice ??
          "Элемент перенесён из старой коллекции и доступен только для чтения.",
      );
      return;
    }
    let valueToSave = form.value;
    if (active === "departments") {
      valueToSave = parseIds(form.value).join(",");
    } else {
      valueToSave = form.value.trim();
      if (!valueToSave) {
        setHint("Заполните значение элемента.");
        return;
      }
    }
    try {
      let saved: CollectionItem | null = null;
      if (form._id) {
        saved = await updateCollectionItem(form._id, {
          name: trimmedName,
          value: valueToSave,
        }, { collectionType: active });
      } else {
        saved = await createCollectionItem(active, {
          name: trimmedName,
          value: valueToSave,
        });
      }
      if (!saved) {
        throw new Error("Сервер не вернул сохранённый элемент");
      }
      setHint("");
      await load();
      closeCollectionModal();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось сохранить элемент";
      setHint(message);
    }
  };

  const remove = async () => {
    if (!form._id) return;
    if (selectedCollectionInfo.readonly) {
      setHint(
        selectedCollectionInfo.notice ??
          "Элемент перенесён из старой коллекции и доступен только для чтения.",
      );
      return;
    }
    try {
      await removeCollectionItem(form._id);
      setHint("");
      await load();
      closeCollectionModal();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
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

  const roleMap = useMemo(() => {
    const map = new Map<string, string>();
    allRoles.forEach((role) => map.set(role._id, role.name));
    return map;
  }, [allRoles]);

  const { divisionOwners, duplicateDivisionIds } = useMemo(() => {
    const owners = new Map<string, string>();
    const duplicates = new Set<string>();
    allDepartments.forEach((department) => {
      parseIds(department.value).forEach((divisionId) => {
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
    return { divisionOwners: owners, duplicateDivisionIds: Array.from(duplicates) };
  }, [allDepartments]);

  const duplicateDivisionHint = useMemo(() => {
    if (!duplicateDivisionIds.length) return "";
    const names = duplicateDivisionIds
      .map(
        (id) =>
          divisionMap.get(id) ??
          allDivisions.find((division) => division._id === id)?.name ??
          id,
      )
      .filter((name): name is string => Boolean(name));
    const suffix = names.length ? `: ${names.join(", ")}.` : ".";
    return `${DUPLICATE_DIVISION_HINT_PREFIX}${suffix}`;
  }, [duplicateDivisionIds, divisionMap, allDivisions]);

  useEffect(() => {
    if (duplicateDivisionHint) {
      setHint((prev) => (prev ? prev : duplicateDivisionHint));
      return;
    }
    setHint((prev) =>
      prev && prev.startsWith(DUPLICATE_DIVISION_HINT_PREFIX) ? "" : prev,
    );
  }, [duplicateDivisionHint]);

  const getItemDisplayValue = useCallback(
    (item: CollectionItem, type: CollectionKey) => {
      if (type === "departments") {
        const ids = parseIds(item.value);
        if (!ids.length) return SETTINGS_BADGE_EMPTY;
        const names = ids
          .map(
            (id) =>
              divisionMap.get(id) ??
              allDivisions.find((division) => division._id === id)?.name ??
              id,
          )
          .filter((name): name is string => Boolean(name));
        return names.length ? names.join("\n") : SETTINGS_BADGE_EMPTY;
      }
      if (type === "divisions") {
        const departmentName =
          departmentMap.get(item.value) ??
          allDepartments.find((department) => department._id === item.value)?.name ??
          item.value;
        return departmentName || SETTINGS_BADGE_EMPTY;
      }
      if (type === "positions") {
        const divisionName =
          divisionMap.get(item.value) ??
          allDivisions.find((division) => division._id === item.value)?.name ??
          item.value;
        return divisionName || SETTINGS_BADGE_EMPTY;
      }
      return item.value || SETTINGS_BADGE_EMPTY;
    },
    [
      allDepartments,
      allDivisions,
      departmentMap,
      divisionMap,
    ],
  );

  const buildCollectionColumns = useCallback(
    (excludedKeys: string[]) =>
      collectionColumns.filter(
        (column) =>
          !hasAccessorKey(column) ||
          !excludedKeys.includes(column.accessorKey),
      ),
    [],
  );

  const departmentColumns = useMemo(
    () => buildCollectionColumns(["value", "type", "metaSummary"]),
    [buildCollectionColumns],
  );

  const divisionColumns = useMemo(
    () => buildCollectionColumns(["type", "metaSummary"]),
    [buildCollectionColumns],
  );

  const positionColumns = useMemo(
    () => buildCollectionColumns(["type", "metaSummary"]),
    [buildCollectionColumns],
  );

  const renderDepartmentValueField = useCallback(
    (
      currentForm: ItemForm,
      handleChange: (next: ItemForm) => void,
      options?: { readonly?: boolean },
    ) => {
      const selected = parseIds(currentForm.value);
      const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const values = Array.from(event.target.selectedOptions).map(
          (option) => option.value,
        );
        handleChange({ ...currentForm, value: values.join(",") });
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

  const totalPages = Math.ceil(total / limit) || 1;
  const filteredUsers = users.filter((u) => {
    const q = userQuery.toLowerCase();
    const login = (u.username ?? "").toLowerCase();
    const telegramLogin = u.telegram_username?.toLowerCase() ?? "";
    return (
      !q ||
      login.includes(q) ||
      telegramLogin.includes(q) ||
      u.name?.toLowerCase().includes(q)
    );
  });
  const userTotalPages = Math.ceil(filteredUsers.length / limit) || 1;
  const paginatedUsers = filteredUsers.slice(
    (userPage - 1) * limit,
    userPage * limit,
  );

  const employeeDetails = useMemo(() => {
    const byId = new Map<string, Partial<EmployeeRow>>();
    const byUsername = new Map<string, Partial<EmployeeRow>>();
    items
      .filter((item) => item.type === "employees")
      .forEach((item) => {
        const parsed = parseEmployeeValue(item.value);
        const { telegram_id: parsedTelegramId, ...rest } = parsed;
        const detail: Partial<EmployeeRow> = { ...rest };
        if (!detail.name && item.name.trim()) {
          detail.name = item.name.trim();
        }
        if (item.meta) {
          const meta = item.meta;
          const assignMeta = (
            key: keyof EmployeeRow,
            raw?: string,
          ) => {
            if (detail[key]) return;
            if (typeof raw !== "string") return;
            const trimmed = raw.trim();
            if (!trimmed) return;
            detail[key] = trimmed as unknown as EmployeeRow[typeof key];
          };
          assignMeta("departmentId", meta.departmentId);
          assignMeta("divisionId", meta.divisionId);
          assignMeta("positionId", meta.positionId);
        }
        if (parsedTelegramId) {
          byId.set(String(parsedTelegramId), detail);
        }
        const login =
          typeof detail.telegram_username === "string"
            ? detail.telegram_username.trim().toLowerCase()
            : typeof detail.username === "string"
              ? detail.username.trim().toLowerCase()
              : "";
        if (login) {
          byUsername.set(login, detail);
        }
      });
    return { byId, byUsername };
  }, [items]);

  const employeeRows = useMemo<EmployeeRow[]>(() => {
    const pickString = (value?: string | null, fallback?: string | null) => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }
      if (typeof fallback === "string") {
        const trimmed = fallback.trim();
        if (trimmed) return trimmed;
      }
      return undefined;
    };
    const pickNumber = (value?: number | null, fallback?: number | null) => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof fallback === "number" && Number.isFinite(fallback)) return fallback;
      return undefined;
    };

    return paginatedUsers.map((user) => {
      const idKey =
        user.telegram_id !== undefined && user.telegram_id !== null
          ? String(user.telegram_id)
          : undefined;
      const usernameKey = pickString(
        user.telegram_username,
        user.username,
      )?.toLowerCase();
      const detail =
        (idKey ? employeeDetails.byId.get(idKey) : undefined) ||
        (usernameKey ? employeeDetails.byUsername.get(usernameKey) : undefined);

      const resolvedTelegramId = pickNumber(user.telegram_id, detail?.telegram_id);
      const resolvedUsername = pickString(user.username, detail?.username);
      const resolvedTelegramUsername = pickString(
        user.telegram_username,
        detail?.telegram_username ?? detail?.username,
      );
      const resolvedName = pickString(user.name, detail?.name) ?? "";
      const resolvedPhone = pickString(user.phone, detail?.phone) ?? "";
      const resolvedMobNumber = pickString(user.mobNumber, detail?.mobNumber) ?? "";
      const resolvedEmail = pickString(user.email, detail?.email) ?? "";
      const resolvedRole = pickString(user.role, detail?.role);
      const resolvedAccess = pickNumber(user.access, detail?.access);

      const rawRoleId = pickString(user.roleId, detail?.roleId) ?? "";
      const rawDepartmentId = pickString(user.departmentId, detail?.departmentId) ?? "";
      const rawDivisionId = pickString(user.divisionId, detail?.divisionId) ?? "";
      const rawPositionId = pickString(user.positionId, detail?.positionId) ?? "";

      const fallbackRoleName = pickString(user.roleName, detail?.roleName);
      const fallbackDepartmentName = pickString(
        user.departmentName,
        detail?.departmentName,
      );
      const fallbackDivisionName = pickString(
        user.divisionName,
        detail?.divisionName,
      );
      const fallbackPositionName = pickString(
        user.positionName,
        detail?.positionName,
      );

      const roleNameFromMap = resolveReferenceName(
        roleMap,
        rawRoleId,
        fallbackRoleName,
      );
      const departmentName = resolveReferenceName(
        departmentMap,
        rawDepartmentId,
        fallbackDepartmentName,
      );
      const divisionName = resolveReferenceName(
        divisionMap,
        rawDivisionId,
        fallbackDivisionName,
      );
      const positionName = resolveReferenceName(
        positionMap,
        rawPositionId,
        fallbackPositionName,
      );

      const roleLabel =
        roleNameFromMap || (resolvedRole ? formatRoleName(resolvedRole) : "");

      return {
        ...user,
        telegram_id: resolvedTelegramId,
        username:
          resolvedUsername ??
          (resolvedTelegramId !== undefined ? String(resolvedTelegramId) : ""),
        telegram_username: resolvedTelegramUsername,
        name: resolvedName,
        phone: resolvedPhone,
        mobNumber: resolvedMobNumber,
        email: resolvedEmail,
        role: resolvedRole ?? user.role,
        access: resolvedAccess ?? user.access,
        roleId: rawRoleId,
        departmentId: rawDepartmentId,
        divisionId: rawDivisionId,
        positionId: rawPositionId,
        roleName: roleLabel,
        departmentName,
        divisionName,
        positionName,
      };
    });
  }, [
    paginatedUsers,
    employeeDetails,
    roleMap,
    departmentMap,
    divisionMap,
    positionMap,
  ]);
  const selectedEmployee = useMemo(
    () =>
      selectedEmployeeId
        ? users.find((u) => String(u.telegram_id) === selectedEmployeeId)
        : undefined,
    [selectedEmployeeId, users],
  );

  const selectedDepartmentDivisionNames = useMemo(() => {
    if (!selectedCollection || selectedCollection.type !== "departments") {
      return [] as string[];
    }
    const ids = parseIds(selectedCollection.value);
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
    if (!selectedCollection || selectedCollection.type !== "divisions") {
      return SETTINGS_BADGE_EMPTY;
    }
    const departmentId = selectedCollection.value;
    if (!departmentId) return SETTINGS_BADGE_EMPTY;
    return (
      departmentMap.get(departmentId) ??
      allDepartments.find((department) => department._id === departmentId)?.name ??
      departmentId
    );
  }, [selectedCollection, departmentMap, allDepartments]);

  const selectedDivisionPositionNames = useMemo(() => {
    if (!selectedCollection || selectedCollection.type !== "divisions") {
      return [] as string[];
    }
    return allPositions
      .filter((position) => position.value === selectedCollection._id)
      .map((position) => position.name)
      .filter((name): name is string => Boolean(name));
  }, [selectedCollection, allPositions]);

  const selectedDivisionEmployeeNames = useMemo(() => {
    if (!selectedCollection || selectedCollection.type !== "divisions") {
      return [] as string[];
    }
    return users
      .filter((user) => user.divisionId === selectedCollection._id)
      .map((user) => {
        if (user.name && user.name.trim()) return user.name.trim();
        if (user.username && user.username.trim()) return user.username.trim();
        if (user.telegram_id !== undefined && user.telegram_id !== null)
          return `ID ${user.telegram_id}`;
        return "Без имени";
      });
  }, [selectedCollection, users]);

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-3 pb-12 pt-4 sm:px-4 lg:px-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Управление предприятием
        </h1>
        {hint && <div className="text-sm text-red-600">{hint}</div>}
      </header>
      <Tabs
        value={active}
        onValueChange={(v) => {
          setActive(v as CollectionKey);
          setPage(1);
        }}
        className="space-y-5"
      >
        <div className="sm:hidden">
          <label htmlFor="settings-section-select" className="sr-only">
            Выбор раздела настроек
          </label>
          <select
            id="settings-section-select"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-transparent transition focus:border-blue-400 focus:outline-none focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={active}
            onChange={(event) => {
              const next = event.target.value as CollectionKey;
              setActive(next);
              setPage(1);
            }}
          >
            {types.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <TabsList
          className="hidden gap-2 sm:grid sm:gap-2 sm:overflow-visible sm:p-1 sm:[grid-template-columns:repeat(7,minmax(9.5rem,1fr))]"
        >
          {types.map((t) => {
            const Icon = tabIcons[t.key as CollectionKey];
            const labelId = `${t.key}-tab-label`;
            return (
              <TabsTrigger
                key={t.key}
                value={t.key}
                aria-label={t.label}
                aria-labelledby={labelId}
                className="group flex h-full min-h-[3.1rem] w-full items-center justify-center gap-2 rounded-xl border border-transparent px-2.5 py-2 text-center text-sm font-semibold transition-colors duration-200 ease-out hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:hover:bg-slate-800 data-[state=active]:border-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:border-slate-700 dark:data-[state=active]:bg-slate-900/70 dark:data-[state=active]:text-slate-100 sm:flex-col sm:gap-1.5 sm:px-3 sm:py-2.5"
              >
                {Icon ? (
                  <Icon className="size-5 flex-shrink-0 text-slate-500 transition-colors group-data-[state=active]:text-blue-600 dark:text-slate-400 dark:group-data-[state=active]:text-blue-300 sm:size-6" />
                ) : null}
                <span className="flex min-w-0 flex-col items-center">
                  <span
                    id={labelId}
                    className="truncate text-sm font-semibold leading-5 text-slate-800 transition-colors group-data-[state=active]:text-blue-700 dark:text-slate-100 dark:group-data-[state=active]:text-blue-300 sm:text-base"
                  >
                    {t.label}
                  </span>
                  {t.description ? (
                    <span
                      aria-hidden="true"
                      className="hidden text-xs font-medium text-slate-500 dark:text-slate-400 sm:block"
                    >
                      {t.description}
                    </span>
                  ) : null}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        <div className="flex-1 space-y-6">
          {types.map((t) => {
            const rows: CollectionTableRow[] =
              t.key === "departments" ||
              t.key === "divisions" ||
              t.key === "positions"
                ? items.map((item) => ({
                    ...item,
                    displayValue: String(getItemDisplayValue(item, t.key)),
                    metaSummary: item.meta ? JSON.stringify(item.meta) : "",
                  }))
                : items.map((item) => ({
                    ...item,
                    displayValue: item.value,
                    metaSummary: item.meta ? JSON.stringify(item.meta) : "",
                  }));
          const columnsForType =
            t.key === "departments"
              ? departmentColumns
              : t.key === "divisions"
                ? divisionColumns
                : t.key === "positions"
                  ? positionColumns
                  : collectionColumns;
          return (
            <TabsContent
              key={t.key}
              value={t.key}
              className="mt-0 flex flex-col gap-4"
            >
              {t.key === "users" ? (
                <div className="space-y-4">
                  <form
                    onSubmit={submitUserSearch}
                    className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 lg:grid lg:grid-cols-[minmax(0,18rem)_auto_auto] lg:items-center lg:gap-3"
                  >
                    <label className="flex flex-col gap-1 sm:w-64 lg:w-full lg:min-w-0">
                      <span className="text-sm font-medium">Поиск</span>
                      <input
                        id="settings-users-search"
                        name="userSearch"
                        className="h-10 w-full rounded border px-3 text-sm lg:h-9 lg:text-xs"
                        value={userSearchDraft}
                        onChange={(event) => setUserSearchDraft(event.target.value)}
                        placeholder="Имя или логин"
                      />
                    </label>
                    <Button
                      type="submit"
                      className={actionButtonClass}
                    >
                      Искать
                    </Button>
                    <Button
                      type="button"
                      variant="success"
                      className={actionButtonClass}
                      onClick={() => openUserModal()}
                    >
                      Добавить
                    </Button>
                  </form>
                  <DataTable
                    columns={settingsUserColumns}
                    data={paginatedUsers}
                    pageIndex={userPage - 1}
                    pageSize={limit}
                    pageCount={userTotalPages}
                    onPageChange={(index) => setUserPage(index + 1)}
                    showGlobalSearch={false}
                    showFilters={false}
                    onRowClick={(row) => openUserModal(row)}
                    wrapCellsAsBadges
                    badgeClassName={SETTINGS_BADGE_CLASS}
                    badgeWrapperClassName={SETTINGS_BADGE_WRAPPER_CLASS}
                    badgeEmptyPlaceholder={SETTINGS_BADGE_EMPTY}
                  />
                </div>
              ) : t.key === "tasks" ? (
                <TaskSettingsTab
                  fields={taskFieldItems}
                  types={taskTypeItems}
                  loading={tasksLoading}
                  onSaveField={saveTaskField}
                  onResetField={resetTaskField}
                  onSaveType={saveTaskType}
                  onResetType={resetTaskType}
                />
              ) : t.key === "employees" ? (
                <div className="space-y-4">
                  <form
                    onSubmit={submitUserSearch}
                    className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 lg:grid lg:grid-cols-[minmax(0,18rem)_auto_auto] lg:items-center lg:gap-3"
                  >
                    <label className="flex flex-col gap-1 sm:w-64 lg:w-full lg:min-w-0">
                      <span className="text-sm font-medium">Поиск</span>
                      <input
                        id="settings-employees-search"
                        name="employeeSearch"
                        className="h-10 w-full rounded border px-3 text-sm lg:h-9 lg:text-xs"
                        value={userSearchDraft}
                        onChange={(event) => setUserSearchDraft(event.target.value)}
                        placeholder="Имя или логин"
                      />
                    </label>
                    <Button
                      type="submit"
                      className={actionButtonClass}
                    >
                      Искать
                    </Button>
                    <Button
                      type="button"
                      variant="success"
                      className={actionButtonClass}
                      onClick={() => openEmployeeModal()}
                    >
                      Добавить
                    </Button>
                  </form>
                  <DataTable
                    columns={settingsEmployeeColumns}
                    data={employeeRows}
                    pageIndex={userPage - 1}
                    pageSize={limit}
                    pageCount={userTotalPages}
                    onPageChange={(index) => setUserPage(index + 1)}
                    showGlobalSearch={false}
                    showFilters={false}
                    onRowClick={(row) => openEmployeeModal(row)}
                    wrapCellsAsBadges
                    badgeClassName={SETTINGS_BADGE_CLASS}
                    badgeWrapperClassName={SETTINGS_BADGE_WRAPPER_CLASS}
                    badgeEmptyPlaceholder={SETTINGS_BADGE_EMPTY}
                  />
                </div>
              ) : t.key === "fleets" ? (
                <FleetVehiclesTab />
              ) : (
                <div className="space-y-4">
                  <form
                    onSubmit={submitCollectionSearch}
                    className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 lg:grid lg:grid-cols-[minmax(0,18rem)_auto_auto] lg:items-center lg:gap-3"
                  >
                    <label className="flex flex-col gap-1 sm:w-64 lg:w-full lg:min-w-0">
                      <span className="text-sm font-medium">Поиск</span>
                      <input
                        id="settings-collections-search"
                        name="collectionSearch"
                        className="h-10 w-full rounded border px-3 text-sm lg:h-9 lg:text-xs"
                        value={currentSearchDraft}
                        onChange={(event) =>
                          updateCollectionSearchDraft(event.target.value)
                        }
                        placeholder="Название или значение"
                      />
                    </label>
                    <Button
                      type="submit"
                      className={actionButtonClass}
                    >
                      Искать
                    </Button>
                    <Button
                      type="button"
                      variant="success"
                      className={actionButtonClass}
                      onClick={() => openCollectionModal()}
                    >
                      Добавить
                    </Button>
                  </form>
                  <DataTable
                    columns={columnsForType}
                    data={rows}
                    pageIndex={page - 1}
                    pageSize={limit}
                    pageCount={totalPages}
                    onPageChange={(index) => setPage(index + 1)}
                    showGlobalSearch={false}
                    showFilters={false}
                    onRowClick={(row) => openCollectionModal(row)}
                    wrapCellsAsBadges
                    badgeClassName={SETTINGS_BADGE_CLASS}
                    badgeWrapperClassName={SETTINGS_BADGE_WRAPPER_CLASS}
                    badgeEmptyPlaceholder={SETTINGS_BADGE_EMPTY}
                  />
                </div>
              )}
            </TabsContent>
          );
        })}
        </div>
      </Tabs>
      <Modal open={collectionModalOpen} onClose={closeCollectionModal}>
        <div className="space-y-4">
          {selectedCollection ? (
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              {selectedCollection.type === "departments" ? (
                <>
                  <h3 className="text-base font-semibold">Информация о департаменте</h3>
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
                      <dt className="font-medium text-slate-500">Отделы департамента</dt>
                      <dd className="mt-2">{renderBadgeList(selectedDepartmentDivisionNames)}</dd>
                    </div>
                  </dl>
                </>
              ) : selectedCollection.type === "divisions" ? (
                <>
                  <h3 className="text-base font-semibold">Информация о департаменте</h3>
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
                      <dt className="font-medium text-slate-500">Департамент</dt>
                      <dd className="text-right text-slate-900">
                        {selectedDivisionDepartmentName || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Должности отдела</dt>
                      <dd className="mt-2">{renderBadgeList(selectedDivisionPositionNames)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Сотрудники отдела</dt>
                      <dd className="mt-2">{renderBadgeList(selectedDivisionEmployeeNames)}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold">Карточка элемента</h3>
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
                        {selectedCollection.value || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Meta</dt>
                      <dd className="mt-1">
                        <pre className="max-h-48 overflow-auto rounded bg-white p-2 text-xs text-slate-800">
                          {selectedCollection.meta
                            ? JSON.stringify(selectedCollection.meta, null, 2)
                            : "{}"}
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
            onReset={() => setForm({ name: "", value: "" })}
            valueLabel={
              active === "departments"
                ? "Отделы"
                : active === "divisions"
                  ? "Департамент"
                  : active === "positions"
                    ? "Отдел"
                    : undefined
            }
            renderValueField={
              active === "departments"
                ? renderDepartmentValueField
                : active === "divisions"
                  ? renderDivisionValueField
                  : active === "positions"
                    ? renderPositionValueField
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
                <h3 className="text-base font-semibold">Карточка пользователя</h3>
                <p className="text-sm text-slate-500">
                  ID: {userForm.telegram_id ?? "—"}
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
                <dt className="font-medium text-slate-500">Telegram ID</dt>
                <dd className="text-slate-900">
                  {userForm.telegram_id ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Логин</dt>
                <dd className="text-slate-900">{userForm.username || "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Имя</dt>
                <dd className="text-slate-900">{userForm.name || "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Телефон</dt>
                <dd className="text-slate-900">{userForm.phone || "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Мобильный</dt>
                <dd className="text-slate-900">{userForm.mobNumber || "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Email</dt>
                <dd className="text-slate-900">{userForm.email || "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Роль</dt>
                <dd className="text-slate-900">{formatRoleName(userForm.role)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Уровень доступа</dt>
                <dd className="text-slate-900">{userForm.access ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Роль ID</dt>
                <dd className="text-slate-900">
                  {userForm.roleId
                    ? formatRoleName(roleMap.get(userForm.roleId) ?? userForm.roleId)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Департамент</dt>
                <dd className="text-slate-900">
                  {userForm.departmentId
                    ? departmentMap.get(userForm.departmentId) ?? userForm.departmentId
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Отдел</dt>
                <dd className="text-slate-900">
                  {userForm.divisionId
                    ? divisionMap.get(userForm.divisionId) ?? userForm.divisionId
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Должность</dt>
                <dd className="text-slate-900">
                  {userForm.positionId
                    ? positionMap.get(userForm.positionId) ?? userForm.positionId
                    : "—"}
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
                  <h3 className="text-base font-semibold">Карточка сотрудника</h3>
                  <p className="text-sm text-slate-500">
                    ID: {selectedEmployee.telegram_id ?? "—"}
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
                    {selectedEmployee.username || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Имя</dt>
                  <dd className="text-slate-900">
                    {selectedEmployee.name || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Телефон</dt>
                  <dd className="text-slate-900">
                    {selectedEmployee.phone || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Мобильный</dt>
                  <dd className="text-slate-900">
                    {selectedEmployee.mobNumber || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Email</dt>
                  <dd className="text-slate-900">
                    {selectedEmployee.email || "—"}
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
                    {selectedEmployee.access ?? "—"}
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
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Департамент</dt>
                  <dd className="text-slate-900">
                    {selectedEmployee.departmentId
                      ? departmentMap.get(selectedEmployee.departmentId) ?? selectedEmployee.departmentId
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Отдел</dt>
                  <dd className="text-slate-900">
                    {selectedEmployee.divisionId
                      ? divisionMap.get(selectedEmployee.divisionId) ?? selectedEmployee.divisionId
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Должность</dt>
                  <dd className="text-slate-900">
                    {selectedEmployee.positionId
                      ? positionMap.get(selectedEmployee.positionId) ?? selectedEmployee.positionId
                      : "—"}
                  </dd>
                </div>
              </dl>
            </article>
          ) : null}
          <EmployeeCardForm
            telegramId={
              employeeFormMode === "update" ? selectedEmployeeId : undefined
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
    </div>
  );
}
