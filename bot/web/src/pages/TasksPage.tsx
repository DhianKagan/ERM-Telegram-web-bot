// Назначение файла: список задач с таблицей AG Grid
// Модули: React, контексты, сервисы задач
import React, { useContext } from "react";
import { useSearchParams } from "react-router-dom";
import TaskTable from "../components/TaskTable";
import { useToast } from "../context/useToast";
import useTasks from "../context/useTasks";
import { fetchTasks } from "../services/tasks";
import authFetch from "../utils/authFetch";
import fields from "../../../src/shared/taskFields";
import { AuthContext } from "../context/AuthContext";

interface Task {
  _id: string;
  title: string;
  status: string;
  task_number: string;
  createdAt: string;
  start_date?: string;
  due_date?: string;
  priority?: string;
  assigned_user_id?: number;
  assignees?: number[];
  attachments?: { name: string; url: string }[];
}

interface User {
  telegram_id: number;
  username: string;
  name?: string;
  phone?: string;
}

export default function TasksPage() {
  const [all, setAll] = React.useState<Task[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [params, setParams] = useSearchParams();
  const { addToast } = useToast();
  const { version, refresh } = useTasks();
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === "admin";
  const [query, setQuery] = React.useState("");
  const [search, setSearch] = React.useState("");

  const load = React.useCallback(() => {
    setLoading(true);
    fetchTasks({}, Number((user as any)?.telegram_id))
      .then((data) => {
        const tasks = Array.isArray(data) ? data : data.tasks || [];
        const filteredTasks = isAdmin
          ? tasks
          : tasks.filter((t) => {
              const assigned =
                t.assignees || (t.assigned_user_id ? [t.assigned_user_id] : []);
              return (
                assigned.includes((user as any).telegram_id) ||
                t.created_by === (user as any).telegram_id
              );
            });
        setAll(filteredTasks);
        const list = Array.isArray((data as any).users)
          ? (data as any).users
          : Object.values((data as any).users || {});
        setUsers(list);
      })
      .finally(() => setLoading(false));
    if (isAdmin) {
      authFetch("/api/v1/users")
        .then((r) => (r.ok ? r.json() : []))
        .then((list) =>
          setUsers(Array.isArray(list) ? list : Object.values(list || {})),
        );
    }
    setStatuses(fields.find((f) => f.name === "status")?.options || []);
  }, [isAdmin, user]);

  React.useEffect(load, [load, version]);
  const tasks = React.useMemo(() => all, [all]);

  const userMap = React.useMemo(() => {
    const map: Record<number, User> = {};
    users.forEach((u) => {
      map[u.telegram_id] = u;
    });
    return map;
  }, [users]);

  React.useEffect(() => {
    if (statuses.length && !bulkStatus) setBulkStatus(statuses[0]);
  }, [statuses, bulkStatus]);

  const changeStatus = async () => {
    await authFetch("/api/v1/tasks/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selected, status: bulkStatus }),
    });
    setSelected([]);
    addToast("Статус обновлён");
    load();
  };

  const changeStatusTo = async (s: string) => {
    await authFetch("/api/v1/tasks/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selected, status: s }),
    });
    setSelected([]);
    addToast("Статус обновлён");
    load();
  };

  return (
    <div className="space-y-6">
      {loading && <div>Загрузка...</div>}
      <div className="flex items-center justify-end">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={refresh}
            className="btn btn-blue xsm:w-full hover:shadow-lg"
          >
            Обновить
          </button>
          <button
            onClick={() => {
              params.set("newTask", "1");
              setParams(params);
            }}
            className="btn btn-blue xsm:w-full hover:shadow-lg"
          >
            Новая задача
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск"
          className="rounded border px-2 py-1"
        />
        <button
          onClick={() => setSearch(query)}
          className="btn btn-blue xsm:w-full hover:shadow-lg"
        >
          Искать
        </button>
      </div>
      <TaskTable
        tasks={tasks}
        users={userMap}
        quickFilterText={search}
        selectable
        onSelectionChange={setSelected}
        onRowClick={(id) => {
          params.set("task", id);
          setParams(params);
        }}
      />
      {selected.length > 0 &&
        (isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="rounded border px-1"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button onClick={changeStatus} className="btn-green xsm:w-full">
              Сменить статус
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => changeStatusTo("В работе")}
              className="btn-green xsm:w-full"
            >
              В работу
            </button>
            <button
              onClick={() => changeStatusTo("Выполнена")}
              className="btn-blue xsm:w-full"
            >
              Выполнена
            </button>
          </div>
        ))}
    </div>
  );
}
