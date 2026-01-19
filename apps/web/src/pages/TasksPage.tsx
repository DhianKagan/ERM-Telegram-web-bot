// Назначение файла: список задач с таблицей DataTable
// Модули: React, контексты, сервисы задач, shared
import React from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormGroup } from '@/components/ui/form-group';
import FilterGrid from '@/components/FilterGrid';
import PageHeader from '@/components/PageHeader';
import GlobalSearch from '../components/GlobalSearch';
import SearchFilters from '../components/SearchFilters';
import TaskCard from '../components/TaskCard';
import TaskTable from '../components/TaskTable';
import Spinner from '../components/Spinner';
import ConfirmDialog from '../components/ConfirmDialog';
import useTasks from '../context/useTasks';
import {
  useTaskIndex,
  useTaskIndexMeta,
} from '../controllers/taskStateController';
import { deleteTask, useTasksQuery } from '../services/tasks';
import { useApiQuery } from '../hooks/useApiQuery';
import { type Task, type User } from 'shared';
import { useAuth } from '../context/useAuth';
import { showToast } from '../utils/toast';
import type { TaskRow } from '../columns/taskColumns';
import type { GlobalSearchHandle } from '../components/GlobalSearch';
import type { SearchFiltersHandle } from '../components/SearchFilters';

type TaskExtra = Task & {
  assigned_user_id?: number;
  [key: string]: unknown;
};

export default function TasksPage() {
  const [page, setPage] = React.useState(0);
  const [users, setUsers] = React.useState<User[]>([]);
  const [visibleTasks, setVisibleTasks] = React.useState<TaskRow[]>([]);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(
    null,
  );
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [mine, setMine] = React.useState(params.get('mine') === '1');
  const { version, refresh, controller, filters, setFilterUsers } = useTasks();
  const { user, loading: authLoading } = useAuth();
  const searchRef = React.useRef<GlobalSearchHandle>(null);
  const filtersRef = React.useRef<SearchFiltersHandle>(null);
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
  const handleSearch = React.useCallback(() => {
    searchRef.current?.search();
    filtersRef.current?.apply();
  }, []);

  const handleReset = React.useCallback(() => {
    searchRef.current?.reset();
    filtersRef.current?.reset();
  }, []);

  const handleMineChange = React.useCallback(
    (value: boolean) => {
      setMine(value);
      const next = new URLSearchParams(params);
      if (value) {
        next.set('mine', '1');
      } else {
        next.delete('mine');
      }
      setParams(next);
    },
    [params, setParams],
  );

  const openTask = React.useCallback(
    (id: string) => {
      params.set('task', id);
      setParams(params);
    },
    [params, setParams],
  );

  const handleShare = React.useCallback(
    async (id: string) => {
      const nextParams = new URLSearchParams(params);
      nextParams.set('task', id);
      nextParams.delete('newTask');
      nextParams.delete('newRequest');
      const link = `${window.location.origin}${location.pathname}?${nextParams.toString()}`;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(link);
          showToast('Ссылка на задачу скопирована', 'success');
          return;
        }
      } catch {
        // игнорируем и используем запасной вариант
      }
      showToast('Не удалось скопировать ссылку', 'error');
    },
    [location.pathname, params],
  );

  const handleDelete = React.useCallback((id: string) => {
    setDeleteTargetId(id);
  }, []);

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTargetId) return;
    const response = await deleteTask(deleteTargetId);
    if (response.ok) {
      showToast('Задача удалена', 'success');
      refresh();
    } else {
      showToast('Не удалось удалить задачу', 'error');
    }
    setDeleteTargetId(null);
  }, [deleteTargetId, refresh]);

  if (authLoading) return <div>Загрузка...</div>;
  if (!canView)
    return <div className="p-4">У вас нет прав для просмотра задач</div>;
  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardDocumentListIcon}
        title="Панель задач"
        description="Единое представление по задачам и назначенным исполнителям."
        filters={
          <FilterGrid
            variant="plain"
            onSearch={handleSearch}
            onReset={handleReset}
            actions={
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    params.set('newTask', '1');
                    setParams(params);
                  }}
                >
                  Создать
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={refresh}
                >
                  Обновить
                </Button>
              </>
            }
          >
            <div className="sm:col-span-2 lg:col-span-1">
              <GlobalSearch ref={searchRef} showActions={false} />
            </div>
            {isPrivileged ? (
              <FormGroup label="Показывать">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    id="task-table-mine"
                    name="mineTasks"
                    type="checkbox"
                    checked={mine}
                    onChange={(e) => handleMineChange(e.target.checked)}
                    className="size-4"
                  />
                  <span>Мои задачи</span>
                </label>
              </FormGroup>
            ) : null}
            <div className="sm:col-span-2 lg:col-span-3">
              <SearchFilters ref={filtersRef} inline showActions={false} />
            </div>
          </FilterGrid>
        }
      />

      <Card>
        {showSpinner ? (
          <div className="flex min-h-[12rem] items-center justify-center">
            <Spinner className="h-6 w-6 text-[color:var(--color-brand-500)]" />
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <TaskTable
                tasks={tasks}
                users={userMap}
                page={page}
                pageCount={Math.ceil((meta.total ?? tasks.length) / 25)}
                mine={isPrivileged ? mine : true}
                onPageChange={setPage}
                onMineChange={isPrivileged ? handleMineChange : undefined}
                onDataChange={setVisibleTasks}
                onOpen={openTask}
                onEdit={openTask}
                onDelete={handleDelete}
                onShare={handleShare}
              />
            </div>
            <div className="grid gap-4 lg:hidden">
              {visibleTasks.length ? (
                visibleTasks.map((task) => (
                  <TaskCard
                    key={task._id ?? task.id}
                    task={task}
                    variant="list"
                    onOpen={openTask}
                  />
                ))
              ) : (
                <div className="rounded-lg border border-border/70 bg-card p-4 text-sm text-muted-foreground">
                  Нет данных для отображения
                </div>
              )}
            </div>
          </>
        )}
      </Card>
      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        message="Удалить задачу? Это действие нельзя отменить."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
