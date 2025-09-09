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

type TaskExtra = Task & Record<string, any>;

export default function TasksPage() {
  const [all, setAll] = React.useState<TaskExtra[]>([]);
  const [page, setPage] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [params, setParams] = useSearchParams();
  const { version, refresh } = useTasks();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "manager";

  const load = React.useCallback(() => {
    setLoading(true);
    fetchTasks(
      { page: page + 1, limit: 25 },
      Number((user as any)?.telegram_id),
    )
      .then((data) => {
        const tasks = (
          Array.isArray(data) ? data : data.tasks || []
        ) as TaskExtra[];
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
        setTotal((data as any).total || filteredTasks.length);
        const list = Array.isArray((data as any).users)
          ? ((data as any).users as User[])
          : (Object.values((data as any).users || {}) as User[]);
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
  }, [isAdmin, user, page]);

  React.useEffect(load, [load, version, page]);
  const tasks = React.useMemo(() => all, [all]);

  const userMap = React.useMemo(() => {
    const map: Record<number, User> = {};
    users.forEach((u) => {
      map[u.telegram_id] = u;
    });
    return map;
  }, [users]);

  return (
    <div className="space-y-6">
      {loading && <div>Загрузка...</div>}
      <TaskTable
        tasks={tasks}
        users={userMap}
        page={page}
        pageCount={Math.ceil(total / 25)}
        onPageChange={setPage}
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
