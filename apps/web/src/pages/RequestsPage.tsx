// Назначение файла: список заявок с таблицей DataTable
// Модули: React, контексты, сервисы задач, shared
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import TaskTable from '../components/TaskTable';
import useTasks from '../context/useTasks';
import {
  useTaskIndex,
  useTaskIndexMeta,
} from '../controllers/taskStateController';
import { fetchTasks } from '../services/tasks';
import authFetch from '../utils/authFetch';
import { type Task, type User } from 'shared';
import { useAuth } from '../context/useAuth';

interface RequestRow extends Task {
  assigned_user_id?: number;
  [key: string]: unknown;
}

export default function RequestsPage() {
  const [page, setPage] = React.useState(0);
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
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

  const load = React.useCallback(() => {
    if (!user?.telegram_id) {
      controller.setIndex(scopeKey, [], {
        kind: 'request',
        mine,
        userId: undefined,
        pageSize: 25,
        total: 0,
        sort: 'desc',
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchTasks(
      {
        page: page + 1,
        limit: 25,
        mine: mine ? 1 : undefined,
        kind: 'request',
      },
      user.telegram_id,
      true,
    )
      .then((data) => {
        const rawTasks = data.tasks as RequestRow[];
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
          total: data.total || filtered.length,
          sort: 'desc',
        });
        const list = Array.isArray(data.users)
          ? (data.users as User[])
          : (Object.values(data.users || {}) as User[]);
        setUsers(list);
      })
      .finally(() => setLoading(false));
    if (isPrivileged) {
      authFetch('/api/v1/users')
        .then((r) => (r.ok ? r.json() : []))
        .then((list) =>
          setUsers(Array.isArray(list) ? list : Object.values(list || {})),
        )
        .catch(() => undefined);
    }
  }, [controller, isPrivileged, mine, page, scopeKey, user]);

  React.useEffect(() => {
    if (authLoading) return;
    if (!user?.telegram_id) return;
    load();
  }, [authLoading, user, load, version, page, mine]);

  const map = React.useMemo(() => {
    const registry: Record<number, User> = {};
    users.forEach((candidate) => {
      registry[candidate.telegram_id] = candidate;
    });
    return registry;
  }, [users]);

  if (authLoading) {
    return <div>Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Панель заявок
      </h2>
      {loading && <div>Загрузка...</div>}
      <TaskTable
        tasks={tasks}
        users={map}
        page={page}
        pageCount={Math.ceil((meta.total ?? tasks.length) / 25)}
        mine={mine}
        entityKind="request"
        onPageChange={setPage}
        onMineChange={(value) => {
          setMine(value);
          if (value) params.set('mine', '1');
          else params.delete('mine');
          setParams(params);
        }}
        onRowClick={(id) => {
          params.set('task', id);
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
                params.set('newRequest', '1');
                setParams(params);
              }}
              className="rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700"
            >
              Новая заявка
            </button>
          </>
        }
      />
    </div>
  );
}
