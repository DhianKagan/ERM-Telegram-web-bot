// Назначение файла: список задач с таблицей DataTable
// Модули: React, контексты, сервисы задач, shared
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import TaskTable from '../components/TaskTable';
import Spinner from '../components/Spinner';
import ActionBar from '../components/ActionBar';
import Breadcrumbs from '../components/Breadcrumbs';
import useTasks from '../context/useTasks';
import {
  useTaskIndex,
  useTaskIndexMeta,
} from '../controllers/taskStateController';
import { useTasksQuery } from '../services/tasks';
import { useApiQuery } from '../hooks/useApiQuery';
import { type Task, type User } from 'shared';
import { useAuth } from '../context/useAuth';

type TaskExtra = Task & {
  assigned_user_id?: number;
  [key: string]: unknown;
};

export default function TasksPage() {
  const [page, setPage] = React.useState(0);
  const [users, setUsers] = React.useState<User[]>([]);
  const [params, setParams] = useSearchParams();
  const [mine, setMine] = React.useState(params.get('mine') === '1');
  const { version, refresh, controller, filters, setFilterUsers } = useTasks();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const hasPermission = user?.permissions?.includes('tasks');
  const permissionsList = Array.isArray(user?.permissions)
    ? user?.permissions
    : null;
  const hasExplicitPermissions = (permissionsList?.length ?? 0) > 0;
  const isPrivileged = isAdmin || isManager;
  const canView = isPrivileged || hasPermission || !hasExplicitPermissions;

  const effectiveMine = isPrivileged ? mine : true;

  const filterSignature = React.useMemo(() => {
    const statusKey = [...filters.status].sort().join(',');
    const priorityKey = [...filters.priority].sort().join(',');
    const typeKey = [...filters.taskTypes].sort().join(',');
    const assigneeKey = [...filters.assignees].sort((a, b) => a - b).join(',');
    return [
      statusKey,
      priorityKey,
      typeKey,
      assigneeKey,
      filters.from,
      filters.to,
    ].join('|');
  }, [filters]);

  const scopeKey = React.useMemo(() => {
    const userKey = user?.telegram_id ? String(user.telegram_id) : 'anon';
    const mineKey = effectiveMine ? 'mine' : 'all';
    return `tasks:task:${userKey}:${mineKey}:page=${page + 1}:filters=${filterSignature}`;
  }, [effectiveMine, filterSignature, page, user?.telegram_id]);

  const tasks = useTaskIndex(scopeKey) as TaskExtra[];
  const meta = useTaskIndexMeta(scopeKey);

  const updateFilterUserList = React.useCallback(
    (list: User[]) => {
      const map = new Map<
        number,
        { id: number; name: string; username?: string | null }
      >();
      list.forEach((item) => {
        const id = Number(item.telegram_id);
        if (!Number.isFinite(id)) return;
        const displayName =
          (typeof item.name === 'string' && item.name.trim().length > 0
            ? item.name.trim()
            : item.username) ?? `ID ${id}`;
        map.set(id, {
          id,
          name: displayName,
          username: item.username ?? null,
        });
      });
      setFilterUsers(
        Array.from(map.values()).sort((a, b) =>
          a.name.localeCompare(b.name, 'ru'),
        ),
      );
    },
    [setFilterUsers],
  );

  const queryParams = React.useMemo(() => {
    const query: Record<string, unknown> = {
      page: page + 1,
      limit: 25,
      mine: !isPrivileged || mine ? 1 : undefined,
      kind: 'task',
    };
    if (filters.status.length) {
      query.status = filters.status.join(',');
    }
    if (filters.taskTypes.length) {
      query.taskType = filters.taskTypes.join(',');
    }
    if (filters.assignees.length) {
      query.assignees = filters.assignees.join(',');
    }
    return query;
  }, [
    filters.assignees,
    filters.status,
    filters.taskTypes,
    isPrivileged,
    mine,
    page,
  ]);

  const tasksQuery = useTasksQuery(queryParams, user?.telegram_id, scopeKey, {
    enabled: canView && !!user?.telegram_id,
  });
  const {
    data: tasksResponse,
    isFetching: isTasksFetching,
    isLoading: isTasksLoading,
    refetch: refetchTasks,
  } = tasksQuery;

  const usersQuery = useApiQuery<User[]>({
    queryKey: ['users', 'tasks'],
    url: '/api/v1/users',
    enabled: isPrivileged && !!user?.telegram_id,
    parse: async (response) => {
      if (!response.ok) return [];
      const payload = (await response.json().catch(() => [])) as unknown;
      return Array.isArray(payload)
        ? (payload as User[])
        : (Object.values(payload || {}) as User[]);
    },
  });

  React.useEffect(() => {
    if (authLoading) return;
    if (isPrivileged) return;
    if (!mine) {
      setMine(true);
    }
    if (params.get('mine') !== '1') {
      const next = new URLSearchParams(params);
      next.set('mine', '1');
      setParams(next, { replace: true });
    }
  }, [authLoading, isPrivileged, mine, params, setParams]);

  React.useEffect(() => {
    if (authLoading) return;
    if (!user?.telegram_id) {
      controller.setIndex(scopeKey, [], {
        kind: 'task',
        mine: effectiveMine,
        userId: undefined,
        pageSize: 25,
        total: 0,
        sort: 'desc',
      });
      setUsers([]);
    }
  }, [authLoading, controller, effectiveMine, scopeKey, user?.telegram_id]);

  React.useEffect(() => {
    if (!tasksResponse || !user?.telegram_id) return;
    const rawTasks = tasksResponse.tasks as TaskExtra[];
    const filteredTasks = isPrivileged
      ? rawTasks
      : rawTasks.filter((t) => {
          const assigned =
            t.assignees || (t.assigned_user_id ? [t.assigned_user_id] : []);
          const uid = user.telegram_id;
          return assigned.includes(uid) || t.created_by === uid;
        });
    controller.setIndex(scopeKey, filteredTasks, {
      kind: 'task',
      mine: effectiveMine,
      userId: user.telegram_id,
      pageSize: 25,
      total: tasksResponse.total || filteredTasks.length,
      sort: 'desc',
    });
    const responseUsers = Array.isArray(tasksResponse.users)
      ? (tasksResponse.users as User[])
      : (Object.values(tasksResponse.users || {}) as User[]);
    const normalizedUsers =
      usersQuery.data && usersQuery.data.length
        ? usersQuery.data
        : responseUsers;
    setUsers(normalizedUsers);
    updateFilterUserList(normalizedUsers);
  }, [
    controller,
    effectiveMine,
    isPrivileged,
    scopeKey,
    tasksResponse,
    updateFilterUserList,
    user?.telegram_id,
    usersQuery.data,
  ]);

  React.useEffect(() => {
    if (version === 0) return;
    if (!canView || !user?.telegram_id) return;
    void refetchTasks();
  }, [canView, refetchTasks, user?.telegram_id, version]);

  const userMap = React.useMemo(() => {
    const map: Record<number, User> = {};
    users.forEach((u) => {
      map[u.telegram_id] = u;
    });
    return map;
  }, [users]);

  const showSpinner = isTasksLoading || (isTasksFetching && tasks.length === 0);

  if (authLoading) return <div>Загрузка...</div>;
  if (!canView)
    return <div className="p-4">У вас нет прав для просмотра задач</div>;
  return (
    <div className="space-y-4">
      <ActionBar
        breadcrumbs={<Breadcrumbs items={[{ label: 'Задачи' }]} />}
        title="Панель управления задачами"
        description="Единое представление по задачам и назначенным исполнителям."
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={refresh}>
              Обновить
            </Button>
            <Button
              size="sm"
              variant="accent"
              onClick={() => {
                params.set('newTask', '1');
                setParams(params);
              }}
            >
              Новая задача
            </Button>
          </div>
        }
      />

      <div className="rounded-3xl border border-[color:var(--color-gray-200)] bg-white p-3 shadow-[var(--shadow-theme-sm)] dark:border-[color:var(--color-gray-700)] dark:bg-[color:var(--color-gray-dark)] sm:p-4">
        {showSpinner ? (
          <div className="flex min-h-[12rem] items-center justify-center">
            <Spinner className="h-6 w-6 text-[color:var(--color-brand-500)]" />
          </div>
        ) : (
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
                    if (v) params.set('mine', '1');
                    else params.delete('mine');
                    setParams(params);
                  }
                : undefined
            }
            onRowClick={(id) => {
              params.set('task', id);
              setParams(params);
            }}
          />
        )}
      </div>
    </div>
  );
}
