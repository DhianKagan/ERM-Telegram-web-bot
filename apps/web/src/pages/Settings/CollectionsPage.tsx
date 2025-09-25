// Назначение: страница управления коллекциями настроек
// Основные модули: React, Tabs, services/collections
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Breadcrumbs from "../../components/Breadcrumbs";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../components/Tabs";
import {
  fetchCollectionItems,
  createCollectionItem,
  updateCollectionItem,
  removeCollectionItem,
  CollectionItem,
} from "../../services/collections";
import CollectionList from "./CollectionList";
import CollectionForm from "./CollectionForm";
import EmployeeCardForm from "../../components/EmployeeCardForm";
import Modal from "../../components/Modal";
import FleetVehiclesTab from "./FleetVehiclesTab";
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
  const [form, setForm] = useState<ItemForm>({ name: "", value: "" });
  const [hint, setHint] = useState("");
  const [allDepartments, setAllDepartments] = useState<CollectionItem[]>([]);
  const [allDivisions, setAllDivisions] = useState<CollectionItem[]>([]);
  const limit = 10;
  const [users, setUsers] = useState<User[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [userQuery, setUserQuery] = useState("");
  const [userForm, setUserForm] = useState<UserFormData>(emptyUser);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<
    string | undefined
  >(undefined);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [employeeFormMode, setEmployeeFormMode] = useState<"create" | "update">(
    "create",
  );

  const currentQuery = queries[active] ?? "";

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
  }, [active, loadUsers]);

  const selectItem = (item: CollectionItem) => {
    setForm({ _id: item._id, name: item.name, value: item.value });
  };

  const selectUser = (item: CollectionItem) => {
    const u = users.find((x) => String(x.telegram_id) === item._id);
    if (u) setUserForm({ ...u });
  };

  const selectEmployee = (item: CollectionItem) => {
    setSelectedEmployeeId(item._id);
    setEmployeeFormMode("update");
    setIsEmployeeModalOpen(true);
  };

  const handleSearch = (text: string) => {
    setPage(1);
    setQueries((prev) => ({ ...prev, [active]: text }));
  };

  const handleUserSearch = (text: string) => {
    setUserPage(1);
    setUserQuery(text);
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
      setForm({ name: "", value: "" });
      setHint("");
      await load();
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
      setForm({ name: "", value: "" });
      await load();
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
    setUserForm(emptyUser);
    loadUsers();
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
  const userItems = filteredUsers
    .slice((userPage - 1) * limit, userPage * limit)
    .map((u) => ({
      _id: String(u.telegram_id),
      type: "users",
      name: u.name || "",
      value: u.username || "",
    }));

  return (
    <div className="space-y-6 p-4">
      <Breadcrumbs
        items={[{ label: "Задачи", href: "/tasks" }, { label: "Настройки" }]}
      />
      {hint && <div className="text-sm text-red-600">{hint}</div>}
      <Tabs
        value={active}
        onValueChange={(v) => {
          setActive(v as CollectionKey);
          setPage(1);
        }}
        className="flex flex-col gap-6 lg:flex-row lg:items-start"
      >
        <TabsList className="mb-4 flex h-auto w-full snap-x gap-2 overflow-x-auto rounded-2xl bg-white/80 p-2 shadow-inner ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/40 dark:ring-slate-700 sm:flex-wrap lg:sticky lg:top-20 lg:mb-0 lg:max-h-[calc(100vh-6rem)] lg:min-w-[18rem] lg:flex-col lg:gap-2 lg:overflow-visible lg:rounded-xl lg:bg-transparent lg:p-0 lg:shadow-none lg:ring-0">
          {types.map((t) => {
            const Icon = tabIcons[t.key as CollectionKey];
            const labelId = `${t.key}-tab-label`;
            return (
              <TabsTrigger
                key={t.key}
                value={t.key}
                aria-label={t.label}
                aria-labelledby={labelId}
                className="group flex h-auto min-w-[11rem] flex-1 items-center justify-start gap-3 rounded-xl border border-transparent px-3 py-3 text-left text-sm font-semibold transition-colors duration-200 ease-out hover:bg-slate-100/80 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:hover:bg-slate-800/70 sm:min-w-[12rem] lg:min-w-full lg:px-4 data-[state=active]:border-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:border-slate-700 dark:data-[state=active]:bg-slate-900/70 dark:data-[state=active]:text-slate-100 snap-start"
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
          const valueLabel =
            t.key === "departments"
              ? "Отделы"
              : t.key === "divisions"
                ? "Департамент"
                : t.key === "positions"
                  ? "Отдел"
                  : undefined;
          const valueFieldRenderer =
            t.key === "departments"
              ? renderDepartmentValueField
              : t.key === "divisions"
                ? renderDivisionValueField
                : t.key === "positions"
                  ? renderPositionValueField
                  : undefined;
          const valueRenderer =
            t.key === "departments" ||
            t.key === "divisions" ||
            t.key === "positions"
              ? (item: CollectionItem) => getItemDisplayValue(item, t.key)
              : undefined;
          return (
            <TabsContent
              key={t.key}
              value={t.key}
              className="mt-0 flex flex-col gap-4"
            >
              {t.key === "users" ? (
                <div className="flex flex-col gap-4 md:flex-row">
                  <div className="md:w-1/2">
                    <CollectionList
                      items={userItems}
                      selectedId={
                        userForm.telegram_id
                          ? String(userForm.telegram_id)
                          : undefined
                      }
                      totalPages={userTotalPages}
                      page={userPage}
                      onSelect={selectUser}
                      onSearch={handleUserSearch}
                      onPageChange={setUserPage}
                      searchValue={userQuery}
                    />
                  </div>
                  <div className="md:w-1/2">
                    <UserForm
                      form={userForm}
                      onChange={setUserForm}
                      onSubmit={submitUser}
                      onReset={() => setUserForm(emptyUser)}
                    />
                  </div>
                </div>
              ) : t.key === "employees" ? (
                <>
                  <div className="flex flex-col gap-4 md:flex-row">
                    <div className="space-y-2 md:w-1/2">
                      <CollectionList
                        items={userItems}
                        selectedId={selectedEmployeeId}
                        totalPages={userTotalPages}
                        page={userPage}
                        onSelect={selectEmployee}
                        onSearch={handleUserSearch}
                        onPageChange={setUserPage}
                        searchValue={userQuery}
                      />
                      <button
                        type="button"
                        className="btn btn-gray w-full rounded"
                        onClick={() => {
                          setSelectedEmployeeId(undefined);
                          setEmployeeFormMode("create");
                          setIsEmployeeModalOpen(true);
                        }}
                      >
                        Новый сотрудник
                      </button>
                    </div>
                  </div>
                  <Modal
                    open={isEmployeeModalOpen}
                    onClose={() => setIsEmployeeModalOpen(false)}
                  >
                    <EmployeeCardForm
                      telegramId={
                        employeeFormMode === "update"
                          ? selectedEmployeeId
                          : undefined
                      }
                      mode={employeeFormMode}
                      onClose={() => setIsEmployeeModalOpen(false)}
                      onSaved={handleEmployeeSaved}
                    />
                  </Modal>
                </>
              ) : t.key === "fleets" ? (
                <FleetVehiclesTab />
              ) : (
                <div className="flex flex-col gap-4 md:flex-row">
                  <div className="md:w-1/2">
                    <CollectionList
                      items={items}
                      selectedId={form._id}
                      totalPages={totalPages}
                      page={page}
                      onSelect={selectItem}
                      onSearch={handleSearch}
                      onPageChange={setPage}
                      renderValue={valueRenderer}
                      searchValue={currentQuery}
                    />
                  </div>
                  <div className="md:w-1/2">
                    <CollectionForm
                      form={form}
                      onChange={setForm}
                      onSubmit={submit}
                      onDelete={remove}
                      onReset={() => setForm({ name: "", value: "" })}
                      valueLabel={valueLabel}
                      renderValueField={valueFieldRenderer}
                    />
                  </div>
                </div>
              )}
            </TabsContent>
          );
        })}
        </div>
      </Tabs>
    </div>
  );
}
