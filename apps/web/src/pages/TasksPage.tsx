// Назначение файла: список задач с таблицей DataTable
// Модули: React, контексты, сервисы задач, shared
import React from "react";
import { useSearchParams } from "react-router-dom";
import TaskTable from "../components/TaskTable";
import useTasks from "../context/useTasks";
import {
  useTaskIndex,
  useTaskIndexMeta,
} from "../controllers/taskStateController";
import { fetchTasks } from "../services/tasks";
import authFetch from "../utils/authFetch";
import { type Task, type User } from "shared";
import { useAuth } from "../context/useAuth";

type TaskExtra = Task & {
  assigned_user_id?: number;
  [key: string]: unknown;
};

export default function TasksPage() {
  const [page, setPage] = React.useState(0);
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [params, setParams] = useSearchParams();
  const [mine, setMine] = React.useState(params.get("mine") === "1");
  const { version, refresh, controller, filters, setFilterUsers } = useTasks();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const hasPermission = user?.permissions?.includes("tasks");
  const permissionsList = Array.isArray(user?.permissions)
    ? user?.permissions
    : null;
  const hasExplicitPermissions = (permissionsList?.length ?? 0) > 0;
  const isPrivileged = isAdmin || isManager;
  const canView = isPrivileged || hasPermission || !hasExplicitPermissions;

  const effectiveMine = isPrivileged ? mine : true;

  const filterSignature = React.useMemo(() => {
    const statusKey = [...filters.status].sort().join(",");
    const priorityKey = [...filters.priority].sort().join(",");
    const typeKey = [...filters.taskTypes].sort().join(",");
    const assigneeKey = [...filters.assignees].sort((a, b) => a - b).join(",");
    return [
      statusKey,
      priorityKey,
      typeKey,
      assigneeKey,
      filters.from,
      filters.to,
    ].join("|");
  }, [filters]);

  const scopeKey = React.useMemo(() => {
    const userKey = user?.telegram_id ? String(user.telegram_id) : "anon";
    const mineKey = effectiveMine ? "mine" : "all";
    return `tasks:task:${userKey}:${mineKey}:page=${page + 1}:filters=${filterSignature}`;
  }, [effectiveMine, filterSignature, page, user?.telegram_id]);

  const tasks = useTaskIndex(scopeKey) as TaskExtra[];
  const meta = useTaskIndexMeta(scopeKey);

  const updateFilterUserList = React.useCallback(
    (list: User[]) => {
      const map = new Map<number, { id: number; name: string; username?: string | null }>();
      list.forEach((item) => {
        const id = Number(item.telegram_id);
        if (!Number.isFinite(id)) return;
        const displayName =
          (typeof item.name === "string" && item.name.trim().length > 0
            ? item.name.trim()
            : item.username) ?? `ID ${id}`;
        map.set(id, {
          id,
          name: displayName,
          username: item.username ?? null,
        });
      });
      setFilterUsers(Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "ru")));
    },
    [setFilterUsers],
  );

  const load = React.useCallback(() => {
    if (!user?.telegram_id) {
      controller.setIndex(scopeKey, [], {
        kind: "task",
        mine: effectiveMine,
        userId: undefined,
        pageSize: 25,
        total: 0,
        sort: "desc",
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    const queryParams: Record<string, unknown> = {
      page: page + 1,
      limit: 25,
      mine: !isPrivileged || mine ? 1 : undefined,
      kind: "task",
    };
    if (filters.status.length) {
      queryParams.status = filters.status.join(",");
    }
    if (filters.taskTypes.length) {
      queryParams.taskType = filters.taskTypes.join(",");
    }
    if (filters.assignees.length) {
      queryParams.assignees = filters.assignees.join(",");
    }
    fetchTasks(queryParams, user.telegram_id, true)
      .then((data) => {
        const rawTasks = data.tasks as TaskExtra[];
        const filteredTasks = isPrivileged
          ? rawTasks
          : rawTasks.filter((t) => {
              const assigned =
                t.assignees || (t.assigned_user_id ? [t.assigned_user_id] : []);
              const uid = user.telegram_id;
              return assigned.includes(uid) || t.created_by === uid;
            });
        controller.setIndex(scopeKey, filteredTasks, {
          kind: "task",
          mine: effectiveMine,
          userId: user.telegram_id,
          pageSize: 25,
          total: data.total || filteredTasks.length,
          sort: "desc",
        });
        const list = Array.isArray(data.users)
          ? (data.users as User[])
          : (Object.values(data.users || {}) as User[]);
        setUsers(list);
        updateFilterUserList(list);
      })
      .finally(() => setLoading(false));
    if (isPrivileged) {
      authFetch("/api/v1/users")
        .then((r) => (r.ok ? r.json() : []))
        .then((list) => {
          const normalized = Array.isArray(list)
            ? (list as User[])
            : (Object.values(list || {}) as User[]);
          setUsers(normalized);
          updateFilterUserList(normalized);
        })
        .catch(() => undefined);
    }
  }, [
    controller,
    effectiveMine,
    isPrivileged,
    mine,
    page,
    scopeKey,
    user,
    filters,
    updateFilterUserList,
  ]);

  React.useEffect(() => {
    if (authLoading) return;
    if (isPrivileged) return;
    if (!mine) {
      setMine(true);
    }
    if (params.get("mine") !== "1") {
      const next = new URLSearchParams(params);
      next.set("mine", "1");
      setParams(next, { replace: true });
    }
  }, [authLoading, isPrivileged, mine, params, setParams]);

  React.useEffect(() => {
    if (authLoading) return;
    if (!canView) return;
    if (!user?.telegram_id) return;
    load();
    // после загрузки профиля инициируем загрузку задач
  }, [authLoading, user, load, version, page, mine, canView]);

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
      <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Панель управления задачами
      </h2>
      {loading && <div>Загрузка...</div>}
      <TaskTable
        tasks={tasks}
        users={userMap}
        page={page}
        pageCount={Math.ceil((meta.total ?? tasks.length) / 25)}
        mine={isPrivileged ? mine : true}
        onPageChange={setPage}
        onMineChange={
          isPrivileged
            ? (v) => {
                setMine(v);
                if (v) params.set("mine", "1");
                else params.delete("mine");
                setParams(params);
              }
            : undefined
        }
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
