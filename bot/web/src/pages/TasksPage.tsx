// Назначение файла: список задач и функции сортировки
import React from 'react'
import { useSearchParams } from 'react-router-dom'
import KPIOverview from '../components/KPIOverview'
import { useToast } from '../context/useToast'
import useTasks from '../context/useTasks'
import { updateTask } from '../services/tasks'
import authFetch from '../utils/authFetch'
import fields from '../../../shared/taskFields.cjs'
import parseJwt from '../utils/parseJwt'
import userLink from '../utils/userLink'

interface Task {
  _id: string
  title: string
  status: string
  request_id: string
  createdAt: string
  start_date?: string
  due_date?: string
  priority?: string
  assigned_user_id?: number
  assignees?: number[]
  attachments?: { name: string; url: string }[]
}

interface User {
  telegram_id: number
  username: string
  name?: string
  phone?: string
}

interface KpiSummary {
  count: number
  time: number
}

export default function TasksPage() {
  const [all, setAll] = React.useState<Task[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [status, setStatus] = React.useState<string>("all");
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [priorities, setPriorities] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [sortBy, setSortBy] = React.useState<string>('createdAt');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [kpi, setKpi] = React.useState<KpiSummary>({ count: 0, time: 0 });
  const [params, setParams] = useSearchParams();
  const { addToast } = useToast();
  const { version, refresh } = useTasks();
  const [showExport, setShowExport] = React.useState(false);

  const isAdmin = React.useMemo(() => {
    const token = localStorage.getItem('token')
    const data = token ? parseJwt(token) : null
    return data?.role === 'admin'
  }, [])

  const handleAuth = (r) => {
    if (r.status === 401 || r.status === 403) {
      return null;
    }
    return r;
  };

  const load = React.useCallback(() => {
    authFetch("/api/v1/tasks")
      .then(handleAuth)
      .then((r) => (r && r.ok ? r.json() : []))
      .then(setAll);
    if (isAdmin) {
      authFetch("/api/v1/users")
        .then((r) => (r.ok ? r.json() : []))
        .then(setUsers);
    }
    authFetch("/api/v1/tasks/report/summary")
      .then(handleAuth)
      .then((r) => (r && r.ok ? r.json() : { count: 0, time: 0 }))
      .then(setKpi);
    setStatuses(fields.find(f => f.name === 'status')?.options || []);
    setPriorities(fields.find(f => f.name === 'priority')?.options || []);
  }, [isAdmin]);

  React.useEffect(load, [load, version]);

  const filtered = React.useMemo(
    () => (status === 'all' ? all : all.filter((t) => t.status === status)),
    [all, status],
  );
  const tasks = React.useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const v1 = a[sortBy];
      const v2 = b[sortBy];
      if (v1 === undefined) return 1;
      if (v2 === undefined) return -1;
      if (v1 > v2) return sortDir === 'asc' ? 1 : -1;
      if (v1 < v2) return sortDir === 'asc' ? -1 : 1;
      return 0;
    });
    return list;
  }, [filtered, sortBy, sortDir]);
  const counts = React.useMemo(
    () => ({
      all: all.length,
      "Новая": all.filter((t) => t.status === "Новая").length,
      "В работе": all.filter((t) => t.status === "В работе").length,
      "Выполнена": all.filter((t) => t.status === "Выполнена").length,
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


  const renderStatus = (t: Task) =>
    isAdmin ? (
      <select
        value={t.status}
        onChange={async (e) => {
          await updateTask(t._id, { status: e.target.value });
          load();
        }}
        className="rounded border px-1"
      >
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    ) : (
      t.status
    );

  const renderPriority = (t: Task) =>
    isAdmin ? (
      <select
        value={t.priority}
        onChange={async (e) => {
          await updateTask(t._id, { priority: e.target.value });
          load();
        }}
        className="rounded border px-1"
      >
        {priorities.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    ) : (
      t.priority
    );


  const changeStatus = async () => {
    await authFetch("/api/v1/tasks/bulk", {
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

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const exportKeys = React.useMemo(
    () => Array.from(new Set(all.flatMap(t => Object.keys(t)))).sort(),
    [all]
  );

  const toCsv = () => {
    const rows = [exportKeys.join(',')];
    tasks.forEach(t => {
      rows.push(exportKeys.map(k => JSON.stringify(t[k] ?? '')).join(','));
    });
    return rows.join('\n');
  };

  const download = (name: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCsv = async () => {
    await navigator.clipboard.writeText(toCsv());
    addToast('Скопировано');
  };

  const saveCsv = () => download('tasks.csv', toCsv());
  const saveJson = () => download('tasks.json', JSON.stringify(tasks, null, 2));

  return (
    <div className="space-y-6">
      <KPIOverview count={kpi.count} time={kpi.time} />
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {["all", "Новая", "В работе", "Выполнена"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-md px-3 py-1 text-sm ${status === s ? "bg-accentPrimary text-white" : "bg-gray-100 text-gray-600"}`}
            >
              {s === "all" ? "Все" : s} ({counts[s]})
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} className="btn-gray rounded px-3">Обновить</button>
          <button onClick={() => setShowExport(!showExport)} className="btn-gray rounded px-3">Экспорт</button>
          <button
            onClick={() => {
              params.set('newTask', '1')
              setParams(params)
            }}
            className="btn btn-blue"
          >
            Новая задача
          </button>
        </div>
      </div>
      <table className="min-w-full divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white text-sm shadow-sm">
        <thead className="bg-gray-50">
          <tr>
            <th></th>
            <th className="px-4 py-2 text-left cursor-pointer" onClick={() => handleSort('title')}>Название {sortBy==='title'? (sortDir==='asc'?'▲':'▼'):''}</th>
            <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('status')}>Статус {sortBy==='status'? (sortDir==='asc'?'▲':'▼'):''}</th>
            <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('priority')}>Приоритет {sortBy==='priority'? (sortDir==='asc'?'▲':'▼'):''}</th>
            <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('start_date')}>Дата начала {sortBy==='start_date'? (sortDir==='asc'?'▲':'▼'):''}</th>
            <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('due_date')}>Дедлайн {sortBy==='due_date'? (sortDir==='asc'?'▲':'▼'):''}</th>
            <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('assignees')}>Исполнители {sortBy==='assignees'? (sortDir==='asc'?'▲':'▼'):''}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
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
                  onClick={() => {
                    params.set('task', t._id)
                    setParams(params)
                  }}
                >
                  {`${t.request_id} ${t.createdAt.slice(0,10)} ${t.title.replace(/^ERM_\d+\s*/, '')}`}
                </button>
              </td>
              <td className="px-4 py-2 text-center">{renderStatus(t)}</td>
              <td className="px-4 py-2 text-center">{renderPriority(t)}</td>
              <td className="px-4 py-2 text-center">{t.start_date?.slice(0,10)}</td>
              <td className="px-4 py-2 text-center">{t.due_date?.slice(0,10)}</td>
              <td className="px-4 py-2">
                {(t.assignees || (t.assigned_user_id ? [t.assigned_user_id] : []))
                  .map(id => (
                    <span
                      key={id}
                      dangerouslySetInnerHTML={{
                        __html: userLink(id, userMap[id]?.name || userMap[id]?.username)
                      }}
                      className="mr-1"
                    />
                  ))}
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

      {showExport && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button onClick={copyCsv} className="btn-gray rounded px-3">Копировать CSV</button>
            <button onClick={saveCsv} className="btn-gray rounded px-3">Скачать CSV</button>
            <button onClick={saveJson} className="btn-gray rounded px-3">Скачать JSON</button>
          </div>
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-xs">
              <thead>
                <tr>
                  {exportKeys.map(k => (
                    <th key={k} className="px-1 border-b bg-gray-50">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t._id}>
                    {exportKeys.map(k => (
                      <td key={k} className="px-1 border-b">{String(t[k] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
