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

export default function CollectionsPage() {
  const [active, setActive] = useState("employees");
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<ItemForm>({ name: "", value: "" });
  const [hint, setHint] = useState("");
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

  const handleSearch = (text: string) => {
    setPage(1);
    setQuery(text);
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

  const totalPages = Math.ceil(total / limit) || 1;

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
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
