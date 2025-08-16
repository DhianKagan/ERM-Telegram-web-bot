// Назначение файла: список задач с таблицей AG Grid
// Модули: React, контексты, сервисы задач
import React, { useContext } from "react";
import { useSearchParams, Link } from "react-router-dom";
import KPIOverview from "../components/KPIOverview";
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

interface KpiSummary {
  count: number;
  time: number;
}

export default function TasksPage() {
  const [all, setAll] = React.useState<Task[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [status, setStatus] = React.useState<string>("all");
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = React.useState<string>("");
  const [search, setSearch] = React.useState("");
  const [views, setViews] = React.useState<
    { name: string; status: string; search: string }[]
  >([]);
  const [kpi, setKpi] = React.useState<KpiSummary>({ count: 0, time: 0 });
  const [loading, setLoading] = React.useState(true);
  const [params, setParams] = useSearchParams();
  const { addToast } = useToast();
  const { version, refresh } = useTasks();
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === "admin";

  const handleAuth = (r) => {
    if (r.status === 401 || r.status === 403) {
      return null;
    }
    return r;
  };

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
    authFetch("/api/v1/tasks/report/summary")
      .then(handleAuth)
      .then((r) => (r && r.ok ? r.json() : { count: 0, time: 0 }))
      .then(setKpi);
    setStatuses(fields.find((f) => f.name === "status")?.options || []);
  }, [isAdmin, user]);

  React.useEffect(load, [load, version]);

  React.useEffect(() => {
    const stored = localStorage.getItem("taskViews");
    if (stored) {
      try {
        setViews(JSON.parse(stored));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const filtered = React.useMemo(
    () => (status === "all" ? all : all.filter((t) => t.status === status)),
    [all, status],
  );
  const tasks = React.useMemo(() => filtered, [filtered]);
  const counts = React.useMemo(
    () => ({
      all: all.length,
      Новая: all.filter((t) => t.status === "Новая").length,
      "В работе": all.filter((t) => t.status === "В работе").length,
      Выполнена: all.filter((t) => t.status === "Выполнена").length,
    }),
    [all],
  );

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

  const saveView = () => {
    const name = prompt("Название вида?");
    if (!name) return;
    const data = [
      ...views.filter((v) => v.name !== name),
      { name, status, search },
    ];
    setViews(data);
    localStorage.setItem("taskViews", JSON.stringify(data));
    addToast("Вид сохранён");
  };

  const applyView = (name: string) => {
    const v = views.find((x) => x.name === name);
    if (!v) return;
    setStatus(v.status);
    setSearch(v.search);
    addToast("Вид применён");
  };

  return (
    <div className="space-y-6">
      {loading && <div>Загрузка...</div>}
      <KPIOverview count={kpi.count} time={kpi.time} />
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {["all", "Новая", "В работе", "Выполнена"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`xsm:w-full rounded-md px-3 py-1 text-sm ${status === s ? "bg-accentPrimary text-white" : "bg-gray-100 text-gray-600"}`}
            >
              {s === "all" ? "Все" : s} ({counts[s]})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Link to="/cp/kanban" className="btn-gray xsm:w-full rounded px-3">
              Доска
            </Link>
          )}
          <button
            onClick={refresh}
            className="btn-gray xsm:w-full rounded px-3"
          >
            Обновить
          </button>
          <button
            onClick={() => {
              params.set("newTask", "1");
              setParams(params);
            }}
            className="btn btn-blue xsm:w-full"
          >
            Новая задача
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск"
          className="rounded border px-2 py-1"
        />
        {views.length > 0 && (
          <select
            onChange={(e) => {
              if (e.target.value) applyView(e.target.value);
            }}
            className="rounded border px-1"
            value=""
          >
            <option value="">Выбор вида</option>
            {views.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        )}
        <button onClick={saveView} className="btn-gray xsm:w-full rounded px-3">
          Сохранить вид
        </button>
      </div>
      <TaskTable
        tasks={tasks}
        users={userMap}
        selectable
        quickFilterText={search}
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
