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
import FleetVehiclesGrid from "./FleetVehiclesGrid";
import VehicleEditDialog from "./VehicleEditDialog";
import EmployeeCardForm from "../../components/EmployeeCardForm";
import Modal from "../../components/Modal";
import {
  fetchUsers,
  createUser as createUserApi,
  updateUser as updateUserApi,
  type UserDetails,
} from "../../services/users";
import UserForm, { UserFormData } from "./UserForm";
import type { User, VehicleDto } from "shared";
import {
  fetchFleetVehicles,
  patchFleetVehicle,
  replaceFleetVehicle,
  type VehicleUpdatePayload,
} from "../../services/fleets";

const types = [
  { key: "departments", label: "Департамент" },
  { key: "divisions", label: "Отдел" },
  { key: "positions", label: "Должность" },
  { key: "employees", label: "Сотрудник" },
  { key: "fleets", label: "Автопарк" },
  { key: "users", label: "Пользователь" },
];

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
  const [selectedFleetId, setSelectedFleetId] = useState<string | undefined>(undefined);
  const [fleetVehicles, setFleetVehicles] = useState<VehicleDto[]>([]);
  const [fleetInfo, setFleetInfo] = useState<{ id: string; name: string } | null>(null);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehiclesHint, setVehiclesHint] = useState("");
  const [editingVehicle, setEditingVehicle] = useState<VehicleDto | null>(null);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [vehicleSaving, setVehicleSaving] = useState(false);
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
      if (active === "fleets" && selectedFleetId) {
        const current = d.items.find((item) => item._id === selectedFleetId);
        if (current) {
          setForm({ _id: current._id, name: current.name, value: current.value });
          setFleetInfo({ id: current._id, name: current.name });
        }
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
  }, [active, currentQuery, page, selectedFleetId]);

  const loadUsers = useCallback(() => {
    fetchUsers().then((list) => setUsers(list));
  }, []);

  const loadFleetVehicles = useCallback(
    async (fleetId: string) => {
      setVehiclesLoading(true);
      setVehiclesHint("");
      try {
        const data = await fetchFleetVehicles(fleetId);
        setFleetVehicles(data.vehicles);
        setFleetInfo(data.fleet);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Не удалось загрузить транспорт";
        setVehiclesHint(message);
        setFleetVehicles([]);
        const fallback = items.find((item) => item._id === fleetId);
        setFleetInfo(fallback ? { id: fallback._id, name: fallback.name } : null);
      } finally {
        setVehiclesLoading(false);
      }
    },
    [items],
  );

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
      if (active !== "fleets" || !selectedFleetId) {
        setForm({ name: "", value: "" });
      }
    } else {
      setHint("");
    }
  }, [load, active, selectedFleetId]);

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

  useEffect(() => {
    if (active === "fleets" && selectedFleetId) {
      void loadFleetVehicles(selectedFleetId);
    }
    if (active !== "fleets") {
      setSelectedFleetId(undefined);
      setFleetVehicles([]);
      setFleetInfo(null);
      setVehiclesHint("");
      setEditingVehicle(null);
      setIsVehicleModalOpen(false);
    }
  }, [active, selectedFleetId, loadFleetVehicles]);

  const selectItem = (item: CollectionItem) => {
    setForm({ _id: item._id, name: item.name, value: item.value });
    if (active === "fleets") {
      setFleetInfo({ id: item._id, name: item.name });
      setVehiclesHint("");
      if (selectedFleetId === item._id) {
        void loadFleetVehicles(item._id);
      } else {
        setSelectedFleetId(item._id);
      }
    }
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
    if (active === "fleets") {
      setSelectedFleetId(undefined);
      setFleetVehicles([]);
      setFleetInfo(null);
      setVehiclesHint("");
    }
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
      setHint("");
      if (active === "fleets" && saved) {
        setSelectedFleetId(saved._id);
        setForm({ _id: saved._id, name: saved.name, value: saved.value });
      } else {
        setForm({ name: "", value: "" });
      }
      await load();
      if (active === "fleets" && saved) {
        await loadFleetVehicles(saved._id);
      }
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
      if (active === "fleets" && selectedFleetId === form._id) {
        setSelectedFleetId(undefined);
        setFleetVehicles([]);
        setFleetInfo(null);
        setVehiclesHint("");
      }
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

  const handleVehicleEdit = (vehicle: VehicleDto) => {
    setEditingVehicle(vehicle);
    setIsVehicleModalOpen(true);
  };

  const closeVehicleModal = () => {
    setIsVehicleModalOpen(false);
    setEditingVehicle(null);
  };

  const submitVehicle = async (
    payload: VehicleUpdatePayload,
    mode: "PATCH" | "PUT",
  ): Promise<void> => {
    if (!selectedFleetId || !editingVehicle) {
      throw new Error("Флот не выбран");
    }
    setVehicleSaving(true);
    try {
      const updated =
        mode === "PUT"
          ? await replaceFleetVehicle(selectedFleetId, editingVehicle.id, payload)
          : await patchFleetVehicle(selectedFleetId, editingVehicle.id, payload);
      setFleetVehicles((prev) =>
        prev.map((vehicle) => (vehicle.id === updated.id ? { ...vehicle, ...updated } : vehicle)),
      );
      setEditingVehicle(updated);
      setVehiclesHint("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось сохранить транспорт";
      throw new Error(message);
    } finally {
      setVehicleSaving(false);
    }
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

  const renderFleetValueField = useCallback(
    (currentForm: ItemForm, handleChange: (next: ItemForm) => void) => (
      <div className="space-y-1">
        <input
          className="h-10 w-full rounded border px-3"
          type="url"
          inputMode="url"
          placeholder="https://hosting.wialon.com/locator?...&t=..."
          value={currentForm.value}
          onChange={(event) =>
            handleChange({ ...currentForm, value: event.target.value })
          }
          required
        />
        <p className="text-xs text-gray-500">
          Вставьте ссылку Wialon Locator с параметром <code>t</code>.
        </p>
      </div>
    ),
    [],
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
      >
        <TabsList className="mb-4 flex gap-2">
          {types.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="px-3 py-1">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {types.map((t) => {
          const valueLabel =
            t.key === "departments"
              ? "Отделы"
              : t.key === "divisions"
                ? "Департамент"
                : t.key === "positions"
                  ? "Отдел"
                  : t.key === "fleets"
                    ? "Ссылка"
                    : undefined;
          const valueFieldRenderer =
            t.key === "departments"
              ? renderDepartmentValueField
              : t.key === "divisions"
                ? renderDivisionValueField
                : t.key === "positions"
                  ? renderPositionValueField
                  : t.key === "fleets"
                    ? renderFleetValueField
                    : undefined;
          const valueRenderer =
            t.key === "departments" ||
            t.key === "divisions" ||
            t.key === "positions"
              ? (item: CollectionItem) => getItemDisplayValue(item, t.key)
              : undefined;
          return (
            <TabsContent key={t.key} value={t.key}>
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
                <div className="flex flex-col gap-4 lg:flex-row">
                  <div className="lg:w-1/3">
                    <CollectionList
                      items={items}
                      selectedId={selectedFleetId}
                      totalPages={totalPages}
                      page={page}
                      onSelect={selectItem}
                      onSearch={handleSearch}
                      onPageChange={setPage}
                      renderValue={valueRenderer}
                      searchValue={currentQuery}
                    />
                  </div>
                  <div className="space-y-4 lg:w-2/3">
                    <CollectionForm
                      form={form}
                      onChange={setForm}
                      onSubmit={submit}
                      onDelete={remove}
                      onReset={() => setForm({ name: "", value: "" })}
                      valueLabel={valueLabel}
                      renderValueField={valueFieldRenderer}
                    />
                    {selectedFleetId ? (
                      <div className="space-y-2">
                        {fleetInfo ? (
                          <div className="text-sm text-gray-600">
                            Автопарк: {fleetInfo.name}
                          </div>
                        ) : null}
                        <FleetVehiclesGrid
                          vehicles={fleetVehicles}
                          loading={vehiclesLoading}
                          error={vehiclesHint}
                          onRefresh={() => {
                            if (selectedFleetId) {
                              void loadFleetVehicles(selectedFleetId);
                            }
                          }}
                          onEdit={handleVehicleEdit}
                        />
                      </div>
                    ) : (
                      <div className="rounded border border-dashed p-4 text-sm text-gray-500">
                        Выберите автопарк, чтобы просмотреть технику.
                      </div>
                    )}
                  </div>
                </div>
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
      </Tabs>
      <Modal open={isVehicleModalOpen} onClose={closeVehicleModal}>
        <VehicleEditDialog
          open={isVehicleModalOpen}
          vehicle={editingVehicle}
          saving={vehicleSaving}
          onClose={closeVehicleModal}
          onSubmit={submitVehicle}
        />
      </Modal>
    </div>
  );
}
