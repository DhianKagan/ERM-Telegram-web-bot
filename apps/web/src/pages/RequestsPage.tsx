// Назначение файла: список заявок с таблицей DataTable
// Модули: React, контексты, сервисы задач, shared
import React from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { InboxArrowDownIcon } from '@heroicons/react/24/outline';
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
import type { GlobalSearchHandle } from '../components/GlobalSearch';
import type { SearchFiltersHandle } from '../components/SearchFilters';

interface RequestRow extends Task {
  assigned_user_id?: number;
  [key: string]: unknown;
}

export default function RequestsPage() {
  const [page, setPage] = React.useState(0);
  const [users, setUsers] = React.useState<User[]>([]);
  const [visibleRequests, setVisibleRequests] = React.useState<RequestRow[]>(
    [],
  );
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(
    null,
  );
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [mine, setMine] = React.useState(params.get('mine') === '1');
  const { version, refresh, controller } = useTasks();
  const { user, loading: authLoading } = useAuth();
  const searchRef = React.useRef<GlobalSearchHandle>(null);
  const filtersRef = React.useRef<SearchFiltersHandle>(null);
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isPrivileged = isAdmin || isManager;

  const scopeKey = React.useMemo(() => {
    const userKey = user?.telegram_id ? String(user.telegram_id) : 'anon';
    const mineKey = mine ? 'mine' : 'all';
    return `tasks:request:${userKey}:${mineKey}:page=${page + 1}`;
  }, [mine, page, user?.telegram_id]);

  const tasks = useTaskIndex(scopeKey) as RequestRow[];
  const meta = useTaskIndexMeta(scopeKey);

  const queryParams = React.useMemo(
    () => ({
      page: page + 1,
      limit: 25,
      mine: mine ? 1 : undefined,
      kind: 'request',
    }),
    [mine, page],
  );

  const {
    data: tasksResponse,
    isFetching,
    isLoading,
    refetch: refetchTasks,
  } = useTasksQuery(queryParams, user?.telegram_id, scopeKey, {
    enabled: !!user?.telegram_id,
  });

  const usersQuery = useApiQuery<User[]>({
    queryKey: ['users', 'requests'],
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
    if (!user?.telegram_id) {
      controller.setIndex(scopeKey, [], {
        kind: 'request',
        mine,
        userId: undefined,
        pageSize: 25,
        total: 0,
        sort: 'desc',
      });
      setUsers([]);
    }
  }, [authLoading, controller, mine, scopeKey, user?.telegram_id]);

  React.useEffect(() => {
    if (!tasksResponse || !user?.telegram_id) return;
    const rawTasks = tasksResponse.tasks as RequestRow[];
    const filtered = isPrivileged
      ? rawTasks
      : rawTasks.filter((t) => {
          const assigned =
            t.assignees || (t.assigned_user_id ? [t.assigned_user_id] : []);
          const uid = user.telegram_id;
          return assigned.includes(uid) || t.created_by === uid;
        });
    controller.setIndex(scopeKey, filtered, {
      kind: 'request',
      mine,
      userId: user.telegram_id,
      pageSize: 25,
      total: tasksResponse.total || filtered.length,
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
  }, [
    controller,
    isPrivileged,
    mine,
    scopeKey,
    tasksResponse,
    user?.telegram_id,
    usersQuery.data,
  ]);

  React.useEffect(() => {
    if (version === 0) return;
    if (!user?.telegram_id) return;
    void refetchTasks();
  }, [refetchTasks, user?.telegram_id, version]);

  const map = React.useMemo(() => {
    const registry: Record<number, User> = {};
    users.forEach((candidate) => {
      registry[candidate.telegram_id] = candidate;
    });
    return registry;
  }, [users]);

  const showSpinner = isLoading || (isFetching && tasks.length === 0);
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

  const openRequest = React.useCallback(
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
          showToast('Ссылка на заявку скопирована', 'success');
          return;
        }
      } catch {
        // fallback
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
      showToast('Заявка удалена', 'success');
      refresh();
    } else {
      showToast('Не удалось удалить заявку', 'error');
    }
    setDeleteTargetId(null);
  }, [deleteTargetId, refresh]);

  if (authLoading) {
    return <div>Загрузка...</div>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={InboxArrowDownIcon}
        title="Панель заявок"
        description="Единый список заявок с фильтрами и экспортом."
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
                    params.set('newRequest', '1');
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
            <FormGroup label="Показывать">
              <label className="flex items-center gap-2 text-sm">
                <input
                  id="request-table-mine"
                  name="mineRequests"
                  type="checkbox"
                  checked={mine}
                  onChange={(event) => handleMineChange(event.target.checked)}
                  className="size-4"
                />
                <span>Мои заявки</span>
              </label>
            </FormGroup>
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
                users={map}
                page={page}
                pageCount={Math.ceil((meta.total ?? tasks.length) / 25)}
                mine={mine}
                entityKind="request"
                onPageChange={setPage}
                onMineChange={handleMineChange}
                onOpen={openRequest}
                onEdit={openRequest}
                onDelete={handleDelete}
                onShare={handleShare}
                onDataChange={setVisibleRequests}
              />
            </div>
            <div className="grid gap-4 lg:hidden">
              {visibleRequests.length ? (
                visibleRequests.map((task) => (
                  <TaskCard
                    key={task._id ?? task.id}
                    task={task}
                    variant="list"
                    onOpen={openRequest}
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
        message="Удалить заявку? Это действие нельзя отменить."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
