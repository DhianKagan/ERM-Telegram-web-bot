// Страница управления задачами
import React from "react";
import TaskFormModal from "../components/TaskFormModal";
import TaskModal from "../components/TaskModal";
import KPIOverview from "../components/KPIOverview";
import { useToast } from "../context/ToastContext";
import { deleteTask } from "../services/tasks";
import authFetch from "../utils/authFetch";

interface Task {
  _id: string
  title: string
  status: string
  time_spent: number
  assigned_user_id?: number
  assignees?: number[]
  attachments?: { name: string; url: string }[]
}

interface User {
  telegram_id: number
  username: string
}

interface KpiSummary {
  count: number
  time: number
}

export default function TasksPage() {
  const [all, setAll] = React.useState<Task[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [status, setStatus] = React.useState<string>("all");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [kpi, setKpi] = React.useState<KpiSummary>({ count: 0, time: 0 });
  const [open, setOpen] = React.useState(false);
  const [viewId, setViewId] = React.useState<string | null>(null);
  const { addToast } = useToast();

  const handleAuth = (r) => {
    if (r.status === 401 || r.status === 403) {
      return null;
    }
    return r;
  };

  const load = React.useCallback(() => {
    authFetch("/api/tasks")
      .then(handleAuth)
      .then((r) => (r && r.ok ? r.json() : []))
      .then(setAll);
    authFetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers);
    authFetch("/api/tasks/report/summary")
      .then(handleAuth)
      .then((r) => (r && r.ok ? r.json() : { count: 0, time: 0 }))
      .then(setKpi);
  }, []);

  React.useEffect(load, [load]);

  const tasks = React.useMemo(
    () => (status === "all" ? all : all.filter((t) => t.status === status)),
    [all, status],
  );
  const counts = React.useMemo(
    () => ({
      all: all.length,
      new: all.filter((t) => t.status === "new").length,
      "in-progress": all.filter((t) => t.status === "in-progress").length,
      done: all.filter((t) => t.status === "done").length,
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

  const add30 = async (id) => {
    await authFetch(`/api/tasks/${id}/time`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ minutes: 30 }),
    });
    load();
  };

  const removeTask = async (id) => {
    const res = await deleteTask(id);
    if (res.status === 204) addToast("Задача удалена");
    load();
  };

  const changeStatus = async () => {
    await authFetch("/api/tasks/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: selected, status: "done" }),
    });
    setSelected([]);
    addToast("Статус обновлён");
    load();
  };

  return (
    <div className="space-y-6">
      <KPIOverview count={kpi.count} time={kpi.time} />
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {["all", "new", "in-progress", "done"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-md px-3 py-1 text-sm ${status === s ? "bg-accentPrimary text-white" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
            >
              {s === "all" ? "Все" : s} ({counts[s]})
            </button>
          ))}
        </div>
        <button onClick={() => setOpen(true)} className="btn btn-blue">
          Новая задача
        </button>
      </div>
      <table className="min-w-full divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th></th>
            <th className="px-4 py-2 text-left">Название</th>
            <th className="px-4 py-2">Статус</th>
            <th className="px-4 py-2">Исполнители</th>
            <th className="px-4 py-2">Время</th>
            <th className="px-4 py-2">Файлы</th>
            <th></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {tasks.map((t) => (
            <tr key={t._id}>
              <td className="px-4 py-2 text-center">
                <input
                  type="checkbox"
                  checked={selected.includes(t._id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, t._id]
                        : selected.filter((id) => id !== t._id),
                    )
                  }
                />
              </td>
              <td className="px-4 py-2">
                <button
                  className="text-accentPrimary hover:underline"
                  onClick={() => setViewId(t._id)}
                >
                  {t.title}
                </button>
              </td>
              <td className="px-4 py-2 text-center">{t.status}</td>
              <td className="px-4 py-2">
                {(t.assignees || (t.assigned_user_id ? [t.assigned_user_id] : []))
                  .map((id) => (
                    <a
                      key={id}
                      href={`tg://user?id=${id}`}
                      className="text-accentPrimary mr-1 underline"
                    >
                      {userMap[id]?.username || id}
                    </a>
                  ))}
              </td>
              <td className="px-4 py-2 text-center">{t.time_spent}</td>
              <td className="px-4 py-2">
                {t.attachments?.map((a) => (
                  <a key={a.url} href={a.url} target="_blank" rel="noopener" className="text-accentPrimary mr-2 underline">
                    {a.name}
                  </a>
                ))}
              </td>
              <td className="px-4 py-2 text-right">
                <button
                  onClick={() => add30(t._id)}
                  className="text-accentPrimary text-xs hover:underline"
                >
                  +30 мин
                </button>
                <button
                  onClick={() => removeTask(t._id)}
                  className="text-danger ml-2 text-xs hover:underline"
                >
                  удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected.length > 0 && (
        <button onClick={changeStatus} className="btn-green">
          Сменить статус
        </button>
      )}
      {open && (
        <TaskFormModal
          onClose={() => setOpen(false)}
          onCreate={() => {
            setOpen(false);
            addToast("Задача создана");
            load();
          }}
        />
      )}
      {viewId && <TaskModal id={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}
