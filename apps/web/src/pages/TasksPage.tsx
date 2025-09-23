// Назначение файла: список задач с таблицей DataTable
// Модули: React, контексты, сервисы задач, shared
import React from "react";
import { useSearchParams } from "react-router-dom";
import TaskTable from "../components/TaskTable";
import useTasks from "../context/useTasks";
import { fetchTasks } from "../services/tasks";
import authFetch from "../utils/authFetch";
import { type Task, type User } from "shared";
import { useAuth } from "../context/useAuth";

type TaskExtra = Task & {
  assigned_user_id?: number;
  [key: string]: unknown;
};

export default function TasksPage() {
  const [all, setAll] = React.useState<TaskExtra[]>([]);
  const [page, setPage] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [params, setParams] = useSearchParams();
  const [mine, setMine] = React.useState(params.get("mine") === "1");
  const { version, refresh } = useTasks();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const hasPermission = user?.permissions?.includes("tasks");
  const isPrivileged = isAdmin || isManager;
  const canView = isPrivileged || hasPermission;

  const load = React.useCallback(() => {
    setLoading(true);
    fetchTasks(
      { page: page + 1, limit: 25, mine: mine ? 1 : undefined },
      user?.telegram_id,
      true,
    )
      .then((data) => {
        const tasks = data.tasks as TaskExtra[];
        const filteredTasks = isPrivileged
          ? tasks
          : tasks.filter((t) => {
              const assigned =
                t.assignees || (t.assigned_user_id ? [t.assigned_user_id] : []);
              const uid = user?.telegram_id ?? 0;
              return assigned.includes(uid) || t.created_by === uid;
            });
        setAll(filteredTasks);
        setTotal(data.total || filteredTasks.length);
        const list = Array.isArray(data.users)
          ? (data.users as User[])
          : (Object.values(data.users || {}) as User[]);
        setUsers(list);
      })
      .finally(() => setLoading(false));
    if (isPrivileged) {
      authFetch("/api/v1/users")
        .then((r) => (r.ok ? r.json() : []))
        .then((list) =>
          setUsers(Array.isArray(list) ? list : Object.values(list || {})),
        );
    }
  }, [isPrivileged, user, page, mine]);

  React.useEffect(() => {
    if (authLoading) return;
    if (!canView || !user?.access) return;
    load();
    // после загрузки профиля инициируем загрузку задач
  }, [authLoading, user, load, version, page, mine, canView]);
  const tasks = React.useMemo(() => all, [all]);

  const userMap = React.useMemo(() => {
    const map: Record<number, User> = {};
    users.forEach((u) => {
      map[u.telegram_id] = u;
    });
    return map;
  }, [users]);

  if (authLoading) return <div>Загрузка...</div>;
  if (!canView)
    return <div className="p-4">У вас нет прав для просмотра задач</div>;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
        Панель управления задачами
      </h1>
      {loading && <div>Загрузка...</div>}
      <TaskTable
        tasks={tasks}
        users={userMap}
        page={page}
        pageCount={Math.ceil(total / 25)}
        mine={mine}
        onPageChange={setPage}
        onMineChange={(v) => {
          setMine(v);
          if (v) params.set("mine", "1");
          else params.delete("mine");
          setParams(params);
        }}
        onRowClick={(id) => {
          params.set("task", id);
          setParams(params);
        }}
        toolbarChildren={
          <>
            <button
              onClick={refresh}
              className="rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700"
            >
              Обновить
            </button>
            <button
              onClick={() => {
                params.set("newTask", "1");
                setParams(params);
              }}
              className="rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700"
            >
              Новая задача
            </button>
          </>
        }
      />
    </div>
  );
}
