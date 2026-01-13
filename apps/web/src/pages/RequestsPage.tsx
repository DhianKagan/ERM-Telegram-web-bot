// Назначение файла: список заявок с таблицей DataTable
// Модули: React, контексты, сервисы задач, shared
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { InboxArrowDownIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormGroup } from '@/components/ui/form-group';
import GlobalSearch from '../components/GlobalSearch';
import SearchFilters from '../components/SearchFilters';
import TaskTable from '../components/TaskTable';
import ActionBar from '../components/ActionBar';
import Breadcrumbs from '../components/Breadcrumbs';
import Spinner from '../components/Spinner';
import useTasks from '../context/useTasks';
import {
  useTaskIndex,
  useTaskIndexMeta,
} from '../controllers/taskStateController';
import { useTasksQuery } from '../services/tasks';
import { useApiQuery } from '../hooks/useApiQuery';
import { type Task, type User } from 'shared';
import { useAuth } from '../context/useAuth';

interface RequestRow extends Task {
  assigned_user_id?: number;
  [key: string]: unknown;
}

export default function RequestsPage() {
  const [page, setPage] = React.useState(0);
  const [users, setUsers] = React.useState<User[]>([]);
  const [params, setParams] = useSearchParams();
  const [mine, setMine] = React.useState(params.get('mine') === '1');
  const { version, refresh, controller } = useTasks();
  const { user, loading: authLoading } = useAuth();
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

  if (authLoading) {
    return <div>Загрузка...</div>;
  }

  return (
    <div className="space-y-4">
      <ActionBar
        breadcrumbs={<Breadcrumbs items={[{ label: 'Заявки' }]} />}
        icon={InboxArrowDownIcon}
        title="Панель заявок"
        description="Единый список заявок с фильтрами и экспортом."
        filters={
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <GlobalSearch />
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
              <SearchFilters inline />
            </div>
          </div>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={refresh}>
              Обновить
            </Button>
            <Button
              size="sm"
              variant="success"
              onClick={() => {
                params.set('newRequest', '1');
                setParams(params);
              }}
            >
              Новая заявка
            </Button>
          </div>
        }
      />

      <Card>
        {showSpinner ? (
          <div className="flex min-h-[12rem] items-center justify-center">
            <Spinner className="h-6 w-6 text-[color:var(--color-brand-500)]" />
          </div>
        ) : (
          <TaskTable
            tasks={tasks}
            users={map}
            page={page}
            pageCount={Math.ceil((meta.total ?? tasks.length) / 25)}
            mine={mine}
            entityKind="request"
            onPageChange={setPage}
            onMineChange={handleMineChange}
            onRowClick={(id) => {
              params.set('task', id);
              setParams(params);
            }}
          />
        )}
      </Card>
    </div>
  );
}
