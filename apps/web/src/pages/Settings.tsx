// Страница настроек: вкладки коллекций и ролей с поиском и формой
// Основные модули: React, Tabs, Pagination, ConfirmDialog, services/collections
import React, { useCallback, useEffect, useState } from "react";
import Breadcrumbs from "../components/Breadcrumbs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/Tabs";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  fetchCollectionItems,
  createCollectionItem,
  updateCollectionItem,
  removeCollectionItem,
  CollectionItem,
} from "../services/collections";

const types = [
  { key: "employees", label: "Сотрудники" },
  { key: "departments", label: "Департаменты" },
  { key: "fleets", label: "Флоты" },
  { key: "roles", label: "Роли" },
];

interface ItemForm {
  _id?: string;
  name: string;
  value: string;
}

export default function Settings() {
  const [active, setActive] = useState("employees");
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<ItemForm>({ name: "", value: "" });
  const [showConfirm, setShowConfirm] = useState(false);
  const limit = 10;

  const load = useCallback(() => {
    fetchCollectionItems(active, query, page, limit).then((d) => {
      setItems(d.items);
      setTotal(d.total);
    });
  }, [active, query, page]);

  useEffect(() => {
    load();
    setForm({ name: "", value: "" });
  }, [load]);

  const selectItem = (item: CollectionItem) => {
    setForm({ _id: item._id, name: item.name, value: item.value });
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(search);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const confirmDelete = async () => {
    if (!form._id) return;
    await removeCollectionItem(form._id);
    setShowConfirm(false);
    setForm({ name: "", value: "" });
    load();
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6 p-4">
      <Breadcrumbs
        items={[{ label: "Задачи", href: "/tasks" }, { label: "Настройки" }]}
      />
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
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="md:w-1/2">
                <form onSubmit={onSearch} className="mb-2 flex gap-2">
                  <input
                    className="h-8 flex-1 rounded border px-2"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск"
                  />
                  <button type="submit" className="btn btn-blue">
                    Искать
                  </button>
                </form>
                <ul className="divide-y rounded border">
                  {items.map((it) => (
                    <li key={it._id}>
                      <button
                        type="button"
                        onClick={() => selectItem(it)}
                        className={`w-full cursor-pointer p-2 text-left ${
                          form._id === it._id ? "bg-gray" : ""
                        }`}
                      >
                        <div className="font-medium">{it.name}</div>
                        <div className="text-sm text-gray-500">{it.value}</div>
                      </button>
                    </li>
                  ))}
                </ul>
                {totalPages > 1 && (
                  <Pagination
                    total={totalPages}
                    page={page}
                    onChange={setPage}
                  />
                )}
              </div>
              <div className="md:w-1/2">
                <form onSubmit={submit} className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium">Имя</label>
                    <input
                      className="h-10 w-full rounded border px-3"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      Значение
                    </label>
                    <input
                      className="h-10 w-full rounded border px-3"
                      value={form.value}
                      onChange={(e) =>
                        setForm({ ...form, value: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="btn btn-blue rounded">
                      Сохранить
                    </button>
                    {form._id && (
                      <button
                        type="button"
                        className="btn btn-red rounded"
                        onClick={() => setShowConfirm(true)}
                      >
                        Удалить
                      </button>
                    )}
                    {!form._id && (
                      <button
                        type="button"
                        className="btn btn-gray rounded"
                        onClick={() => setForm({ name: "", value: "" })}
                      >
                        Очистить
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
      <ConfirmDialog
        open={showConfirm}
        message="Удалить элемент?"
        onConfirm={confirmDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
