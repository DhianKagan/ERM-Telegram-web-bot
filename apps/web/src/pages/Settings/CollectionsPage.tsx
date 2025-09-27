// Назначение: страница управления коллекциями настроек
// Основные модули: React, Tabs, services/collections
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import EmployeeCardForm from "../../components/EmployeeCardForm";
import Modal from "../../components/Modal";
import FleetVehiclesTab from "./FleetVehiclesTab";
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
  type UserDetails,
} from "../../services/users";
import { fetchRoles, type Role } from "../../services/roles";
import { formatRoleName } from "../../utils/roleDisplay";
import UserForm, { UserFormData } from "./UserForm";
import type { User } from "../../types/user";
import {
  SETTINGS_BADGE_CLASS,
  SETTINGS_BADGE_EMPTY,
  SETTINGS_BADGE_WRAPPER_CLASS,
} from "./badgeStyles";
import {
  BuildingOffice2Icon,
  Squares2X2Icon,
  IdentificationIcon,
  UserGroupIcon,
  TruckIcon,
  KeyIcon,
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

const parseIds = (value: string) =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const resolveReferenceName = (
  map: Map<string, string>,
  id?: string | null,
): string => {
  if (typeof id !== "string") return "";
  const trimmed = id.trim();
  if (!trimmed) return "";
  return map.get(trimmed) ?? trimmed;
};

const USERS_ERROR_HINT = "Не удалось загрузить пользователей";

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
    if (active === "users") return;
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
      if (active === "departments") setAllDepartments(d.items);
      if (active === "divisions") setAllDivisions(d.items);
      if (active === "positions") setAllPositions(d.items);
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
    if (active !== "users") {
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
    if (active === "users" || active === "employees" || active === "fleets") {
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

  const closeUserModal = () => {
    setUserModalOpen(false);
    setUserForm(emptyUser);
  };

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
        });
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

  const divisionOwners = useMemo(() => {
    const owners = new Map<string, string>();
    allDepartments.forEach((department) => {
      parseIds(department.value).forEach((divisionId) => {
        if (!owners.has(divisionId)) owners.set(divisionId, department._id);
      });
    });
    return owners;
  }, [allDepartments]);

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
    () => buildCollectionColumns(["value", "_id", "type", "metaSummary"]),
    [buildCollectionColumns],
  );

  const divisionColumns = useMemo(
    () => buildCollectionColumns(["value", "_id", "type", "metaSummary"]),
    [buildCollectionColumns],
  );

  const positionColumns = useMemo(
    () => buildCollectionColumns(["value", "_id"]),
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
    const login = (u.telegram_username ?? u.username ?? "").toLowerCase();
    return !q || login.includes(q) || u.name?.toLowerCase().includes(q);
  });
  const userTotalPages = Math.ceil(filteredUsers.length / limit) || 1;
  const paginatedUsers = filteredUsers.slice(
    (userPage - 1) * limit,
    userPage * limit,
  );

  const employeeRows = useMemo<EmployeeRow[]>(
    () =>
      paginatedUsers.map((user) => {
        const roleNameFromMap = resolveReferenceName(roleMap, user.roleId);
        const departmentName = resolveReferenceName(
          departmentMap,
          user.departmentId,
        );
        const divisionName = resolveReferenceName(
          divisionMap,
          user.divisionId,
        );
        const positionName = resolveReferenceName(
          positionMap,
          user.positionId,
        );
        const roleLabel =
          roleNameFromMap || (user.role ? formatRoleName(user.role) : "");
        return {
          ...user,
          roleName: roleLabel,
          departmentName,
          divisionName,
          positionName,
        };
      }),
    [paginatedUsers, roleMap, departmentMap, divisionMap, positionMap],
  );
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
          className="hidden gap-2 sm:grid sm:gap-2 sm:overflow-visible sm:p-1 sm:[grid-template-columns:repeat(6,minmax(9.5rem,1fr))]"
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
                        className="h-10 w-full rounded border px-3 text-sm lg:h-9 lg:text-xs"
                        value={userSearchDraft}
                        onChange={(event) => setUserSearchDraft(event.target.value)}
                        placeholder="Имя или логин"
                      />
                    </label>
                    <button
                      type="submit"
                      className="btn btn-blue h-10 w-full max-w-[11rem] rounded px-3 text-sm font-semibold sm:w-auto lg:h-8 lg:text-xs"
                    >
                      Искать
                    </button>
                    <button
                      type="button"
                      className="btn btn-green h-10 w-full max-w-[11rem] rounded px-3 text-sm font-semibold sm:w-auto lg:h-8 lg:text-xs"
                      onClick={() => openUserModal()}
                    >
                      Добавить
                    </button>
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
              ) : t.key === "employees" ? (
                <div className="space-y-4">
                  <form
                    onSubmit={submitUserSearch}
                    className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 lg:grid lg:grid-cols-[minmax(0,18rem)_auto_auto] lg:items-center lg:gap-3"
                  >
                    <label className="flex flex-col gap-1 sm:w-64 lg:w-full lg:min-w-0">
                      <span className="text-sm font-medium">Поиск</span>
                      <input
                        className="h-10 w-full rounded border px-3 text-sm lg:h-9 lg:text-xs"
                        value={userSearchDraft}
                        onChange={(event) => setUserSearchDraft(event.target.value)}
                        placeholder="Имя или логин"
                      />
                    </label>
                    <button
                      type="submit"
                      className="btn btn-blue h-10 w-full max-w-[11rem] rounded px-3 text-sm font-semibold sm:w-auto lg:h-8 lg:text-xs"
                    >
                      Искать
                    </button>
                    <button
                      type="button"
                      className="btn btn-green h-10 w-full max-w-[11rem] rounded px-3 text-sm font-semibold sm:w-auto lg:h-8 lg:text-xs"
                      onClick={() => openEmployeeModal()}
                    >
                      Добавить
                    </button>
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
                        className="h-10 w-full rounded border px-3 text-sm lg:h-9 lg:text-xs"
                        value={currentSearchDraft}
                        onChange={(event) =>
                          updateCollectionSearchDraft(event.target.value)
                        }
                        placeholder="Название или значение"
                      />
                    </label>
                    <button
                      type="submit"
                      className="btn btn-blue h-10 w-full max-w-[11rem] rounded px-3 text-sm font-semibold sm:w-auto lg:h-8 lg:text-xs"
                    >
                      Искать
                    </button>
                    <button
                      type="button"
                      className="btn btn-green h-10 w-full max-w-[11rem] rounded px-3 text-sm font-semibold sm:w-auto lg:h-8 lg:text-xs"
                      onClick={() => openCollectionModal()}
                    >
                      Добавить
                    </button>
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
            <h3 className="text-base font-semibold">Карточка пользователя</h3>
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
              <h3 className="text-base font-semibold">Карточка сотрудника</h3>
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
    </div>
  );
}
