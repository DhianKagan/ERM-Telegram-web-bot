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
  fetchUsers,
  createUser as createUserApi,
  updateUser as updateUserApi,
  type UserDetails,
} from "../../services/users";
import UserForm, { UserFormData } from "./UserForm";
import type { User } from "shared";
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

  const loadUsers = useCallback(() => {
    fetchUsers().then((list) => setUsers(list));
  }, []);

  useEffect(() => {
    if (active === "users" || active === "employees") {
      setUserSearchDraft(userQuery);
    }
  }, [active, userQuery]);

  useEffect(() => {
    fetchCollectionItems("departments", "", 1, 200)
      .then((d) => setAllDepartments(d.items))
      .catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Не удалось загрузить департаменты";
        setHint((prev) => prev || message);
      });
    fetchCollectionItems("divisions", "", 1, 200)
      .then((d) => setAllDivisions(d.items))
      .catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Не удалось загрузить отделы";
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
      loadUsers();
      setUserForm(emptyUser);
      setSelectedEmployeeId(undefined);
    }
    if (active === "employees") {
      loadUsers();
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
    username: user?.username ?? "",
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
    loadUsers();
    if (updated.telegram_id !== undefined) {
      setSelectedEmployeeId(String(updated.telegram_id));
      setEmployeeFormMode("update");
    }
  };

  const submit = async () => {
    if (active === "fleets") return;
    const trimmedName = form.name.trim();
    if (!trimmedName) return;
    let valueToSave = form.value;
    if (active === "departments") {
      valueToSave = parseIds(form.value).join(",");
    } else if (active === "divisions" || active === "positions") {
      valueToSave = form.value.trim();
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
    loadUsers();
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
    (item: CollectionItem, type: string) => {
      if (type === "departments") {
        const ids = parseIds(item.value);
        if (!ids.length) return "—";
        const names = ids
          .map((id) => divisionMap.get(id))
          .filter((name): name is string => Boolean(name));
        return names.length ? names.join(", ") : "—";
      }
      if (type === "divisions") {
        return departmentMap.get(item.value) || "—";
      }
      if (type === "positions") {
        return divisionMap.get(item.value) || "—";
      }
      return item.value;
    },
    [departmentMap, divisionMap],
  );

  const renderDepartmentValueField = useCallback(
    (currentForm: ItemForm, handleChange: (next: ItemForm) => void) => {
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
    (currentForm: ItemForm, handleChange: (next: ItemForm) => void) => (
      <select
        className="h-10 w-full rounded border px-3"
        value={currentForm.value}
        onChange={(event) =>
          handleChange({ ...currentForm, value: event.target.value })
        }
        required
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
    (currentForm: ItemForm, handleChange: (next: ItemForm) => void) => (
      <select
        className="h-10 w-full rounded border px-3"
        value={currentForm.value}
        onChange={(event) =>
          handleChange({ ...currentForm, value: event.target.value })
        }
        required
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
    return (
      !q ||
      u.username?.toLowerCase().includes(q) ||
      u.name?.toLowerCase().includes(q)
    );
  });
  const userTotalPages = Math.ceil(filteredUsers.length / limit) || 1;
  const paginatedUsers = filteredUsers.slice(
    (userPage - 1) * limit,
    userPage * limit,
  );
  const selectedEmployee = useMemo(
    () =>
      selectedEmployeeId
        ? users.find((u) => String(u.telegram_id) === selectedEmployeeId)
        : undefined,
    [selectedEmployeeId, users],
  );

  return (
    <div className="space-y-6 p-4">
      {hint && <div className="text-sm text-red-600">{hint}</div>}
      <Tabs
        value={active}
        onValueChange={(v) => {
          setActive(v as CollectionKey);
          setPage(1);
        }}
        className="space-y-6"
      >
        <TabsList className="flex flex-wrap items-stretch gap-3 rounded-2xl bg-white/80 p-3 shadow-inner ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/40 dark:ring-slate-700">
          {types.map((t) => {
            const Icon = tabIcons[t.key as CollectionKey];
            const labelId = `${t.key}-tab-label`;
            return (
              <TabsTrigger
                key={t.key}
                value={t.key}
                aria-label={t.label}
                aria-labelledby={labelId}
                className="group flex h-auto min-w-[11rem] flex-1 items-center justify-start gap-3 rounded-xl border border-transparent px-4 py-3 text-left text-sm font-semibold transition-colors duration-200 ease-out hover:bg-slate-100/80 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:hover:bg-slate-800/70 data-[state=active]:border-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:border-slate-700 dark:data-[state=active]:bg-slate-900/70 dark:data-[state=active]:text-slate-100"
              >
                {Icon ? (
                  <Icon className="size-5 flex-shrink-0 text-slate-500 transition-colors group-data-[state=active]:text-blue-600 dark:text-slate-400 dark:group-data-[state=active]:text-blue-300" />
                ) : null}
                <span className="flex min-w-0 flex-col">
                  <span
                    id={labelId}
                    className="truncate text-base font-semibold leading-5 text-slate-800 transition-colors group-data-[state=active]:text-blue-700 dark:text-slate-100 dark:group-data-[state=active]:text-blue-300"
                  >
                    {t.label}
                  </span>
                  {t.description ? (
                    <span
                      aria-hidden="true"
                      className="truncate text-xs font-medium text-slate-500 dark:text-slate-400"
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
                    className="flex flex-wrap items-end gap-3"
                  >
                    <label className="flex flex-col gap-1 sm:w-64">
                      <span className="text-sm font-medium">Поиск</span>
                      <input
                        className="h-10 w-full rounded border px-3"
                        value={userSearchDraft}
                        onChange={(event) => setUserSearchDraft(event.target.value)}
                        placeholder="Имя или логин"
                      />
                    </label>
                    <button
                      type="submit"
                      className="btn btn-blue h-10 rounded px-4"
                    >
                      Искать
                    </button>
                    <button
                      type="button"
                      className="btn btn-green h-10 rounded px-4"
                      onClick={() => openUserModal()}
                    >
                      Новый пользователь
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
                  />
                </div>
              ) : t.key === "employees" ? (
                <div className="space-y-4">
                  <form
                    onSubmit={submitUserSearch}
                    className="flex flex-wrap items-end gap-3"
                  >
                    <label className="flex flex-col gap-1 sm:w-64">
                      <span className="text-sm font-medium">Поиск</span>
                      <input
                        className="h-10 w-full rounded border px-3"
                        value={userSearchDraft}
                        onChange={(event) => setUserSearchDraft(event.target.value)}
                        placeholder="Имя или логин"
                      />
                    </label>
                    <button
                      type="submit"
                      className="btn btn-blue h-10 rounded px-4"
                    >
                      Искать
                    </button>
                    <button
                      type="button"
                      className="btn btn-green h-10 rounded px-4"
                      onClick={() => openEmployeeModal()}
                    >
                      Новый сотрудник
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
                    onRowClick={(row) => openEmployeeModal(row)}
                  />
                </div>
              ) : t.key === "fleets" ? (
                <FleetVehiclesTab />
              ) : (
                <div className="space-y-4">
                  <form
                    onSubmit={submitCollectionSearch}
                    className="flex flex-wrap items-end gap-3"
                  >
                    <label className="flex flex-col gap-1 sm:w-64">
                      <span className="text-sm font-medium">Поиск</span>
                      <input
                        className="h-10 w-full rounded border px-3"
                        value={currentSearchDraft}
                        onChange={(event) =>
                          updateCollectionSearchDraft(event.target.value)
                        }
                        placeholder="Название или значение"
                      />
                    </label>
                    <button
                      type="submit"
                      className="btn btn-blue h-10 rounded px-4"
                    >
                      Искать
                    </button>
                    <button
                      type="button"
                      className="btn btn-green h-10 rounded px-4"
                      onClick={() => openCollectionModal()}
                    >
                      Добавить
                    </button>
                  </form>
                  <DataTable
                    columns={collectionColumns}
                    data={rows}
                    pageIndex={page - 1}
                    pageSize={limit}
                    pageCount={totalPages}
                    onPageChange={(index) => setPage(index + 1)}
                    showGlobalSearch={false}
                    showFilters={false}
                    onRowClick={(row) => openCollectionModal(row)}
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
                <dd className="text-slate-900">{userForm.role || "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Уровень доступа</dt>
                <dd className="text-slate-900">{userForm.access ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Роль ID</dt>
                <dd className="text-slate-900">{userForm.roleId || "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Департамент</dt>
                <dd className="text-slate-900">{userForm.departmentId || "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Отдел</dt>
                <dd className="text-slate-900">{userForm.divisionId || "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Должность</dt>
                <dd className="text-slate-900">{userForm.positionId || "—"}</dd>
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
                    {selectedEmployee.role || "—"}
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
                    {selectedEmployee.roleId || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Департамент</dt>
                  <dd className="text-slate-900">
                    {selectedEmployee.departmentId || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Отдел</dt>
                  <dd className="text-slate-900">
                    {selectedEmployee.divisionId || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Должность</dt>
                  <dd className="text-slate-900">
                    {selectedEmployee.positionId || "—"}
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
            onClose={() => setIsEmployeeModalOpen(false)}
            onSaved={handleEmployeeSaved}
          />
        </div>
      </Modal>
    </div>
  );
}
