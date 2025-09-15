// Назначение: страница управления коллекциями настроек
// Основные модули: React, Tabs, services/collections
import React, { useCallback, useEffect, useState } from "react";
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
import {
  fetchUsers,
  createUser as createUserApi,
  updateUser as updateUserApi,
} from "../../services/users";
import UserForm, { UserFormData } from "./UserForm";
import type { User } from "shared";

const types = [
  { key: "departments", label: "Департамент" },
  { key: "divisions", label: "Отдел" },
  { key: "roles", label: "Должность" },
  { key: "employees", label: "Сотрудник" },
  { key: "fleets", label: "Автопарк" },
  { key: "users", label: "Пользователь" },
];

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

export default function CollectionsPage() {
  const [active, setActive] = useState("departments");
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<ItemForm>({ name: "", value: "" });
  const [hint, setHint] = useState("");
  const limit = 10;
  const [users, setUsers] = useState<User[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [userQuery, setUserQuery] = useState("");
  const [userForm, setUserForm] = useState<UserFormData>(emptyUser);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | undefined>(
    undefined,
  );

  const load = useCallback(() => {
    if (active === "users") return;
    fetchCollectionItems(active, query, page, limit).then((d) => {
      setItems(d.items);
      setTotal(d.total);
    });
  }, [active, query, page]);

  const loadUsers = useCallback(() => {
    fetchUsers().then((list) => setUsers(list));
  }, []);

  useEffect(() => {
    if (active !== "users") {
      load();
      setForm({ name: "", value: "" });
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
  };

  const handleSearch = (text: string) => {
    setPage(1);
    setQuery(text);
  };

  const handleUserSearch = (text: string) => {
    setUserPage(1);
    setUserQuery(text);
    setSelectedEmployeeId(undefined);
  };

  const submit = async () => {
    if (form._id) {
      await updateCollectionItem(form._id, {
        name: form.name,
        value: form.value,
      });
    } else {
      await createCollectionItem(active, {
        name: form.name,
        value: form.value,
      });
    }
    setForm({ name: "", value: "" });
    load();
  };

  const remove = async () => {
    if (!form._id) return;
    try {
      await removeCollectionItem(form._id);
      setHint("");
      setForm({ name: "", value: "" });
      load();
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
          setActive(v);
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
        {types.map((t) => (
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
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="md:w-1/2 space-y-2">
                  <CollectionList
                    items={userItems}
                    selectedId={selectedEmployeeId}
                    totalPages={userTotalPages}
                    page={userPage}
                    onSelect={selectEmployee}
                    onSearch={handleUserSearch}
                    onPageChange={setUserPage}
                  />
                  <button
                    type="button"
                    className="btn btn-gray w-full rounded"
                    onClick={() => setSelectedEmployeeId(undefined)}
                  >
                    Новый сотрудник
                  </button>
                </div>
                <div className="md:w-1/2">
                  <EmployeeCardForm
                    telegramId={selectedEmployeeId}
                    allowCreate
                    onSaved={(updated) => {
                      loadUsers();
                      if (updated.telegram_id)
                        setSelectedEmployeeId(String(updated.telegram_id));
                    }}
                  />
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
                  />
                </div>
                <div className="md:w-1/2">
                  <CollectionForm
                    form={form}
                    onChange={setForm}
                    onSubmit={submit}
                    onDelete={remove}
                    onReset={() => setForm({ name: "", value: "" })}
                  />
                </div>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
