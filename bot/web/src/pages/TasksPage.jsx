// Страница управления задачами
import React from "react";
import TaskFormModal from "../components/TaskFormModal";
import TaskModal from "../components/TaskModal";
import KPIOverview from "../components/KPIOverview";
import { useToast } from "../context/ToastContext";
import { deleteTask } from "../services/tasks";

export default function TasksPage() {
  const [all, setAll] = React.useState([]);
  const [status, setStatus] = React.useState("all");
  const [selected, setSelected] = React.useState([]);
  const [kpi, setKpi] = React.useState({ count: 0, time: 0 });
  const [open, setOpen] = React.useState(false);
  const [viewId, setViewId] = React.useState(null);
  const { addToast } = useToast();

  const handleAuth = (r) => {
    if (r.status === 401 || r.status === 403) {
      window.location = "/login";
      return null;
    }
    return r;
  };

  const load = React.useCallback(() => {
    fetch("/api/tasks", {
      headers: {
        Authorization: localStorage.token ? `Bearer ${localStorage.token}` : "",
      },
    })
      .then(handleAuth)
      .then((r) => (r && r.ok ? r.json() : []))
      .then(setAll);
    fetch("/api/tasks/report/summary", {
      headers: {
        Authorization: localStorage.token ? `Bearer ${localStorage.token}` : "",
      },
    })
      .then(handleAuth)
      .then((r) => (r && r.ok ? r.json() : { count: 0, time: 0 }))
      .then(setKpi);
  }, []);

  React.useEffect(load, []);

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

  const add30 = async (id) => {
    await fetch(`/api/tasks/${id}/time`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: localStorage.token ? `Bearer ${localStorage.token}` : "",
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
    await fetch("/api/tasks/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: localStorage.token ? `Bearer ${localStorage.token}` : "",
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
              className={`rounded-md px-3 py-1 text-sm ${status === s ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
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
            <th className="px-4 py-2">Время</th>
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
                  className="text-brand-500 hover:underline"
                  onClick={() => setViewId(t._id)}
                >
                  {t.title}
                </button>
              </td>
              <td className="px-4 py-2 text-center">{t.status}</td>
              <td className="px-4 py-2 text-center">{t.time_spent}</td>
              <td className="px-4 py-2 text-right">
                <button
                  onClick={() => add30(t._id)}
                  className="text-brand-500 text-xs hover:underline"
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
