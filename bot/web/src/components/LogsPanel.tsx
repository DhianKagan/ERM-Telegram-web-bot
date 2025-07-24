// Панель логов админки
import React from "react";
import authFetch from "../utils/authFetch";

interface Log {
  _id: string;
  message: string;
  level: string;
  createdAt: string;
}

interface Query {
  level?: string;
  message?: string;
  from?: string;
  to?: string;
  sort?: string;
}

export default function LogsPanel() {
  const [logs, setLogs] = React.useState<Log[]>([]);
  const [query, setQuery] = React.useState<Query>({});

  const loadLogs = React.useCallback(() => {
    const params = new URLSearchParams();
    if (query.level) params.set("level", query.level);
    if (query.message) params.set("message", query.message);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    if (query.sort) params.set("sort", query.sort);
    authFetch(`/api/v1/logs?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setLogs);
  }, [query]);

  React.useEffect(() => {
    loadLogs();
    const id = setInterval(loadLogs, 5000);
    return () => clearInterval(id);
  }, [loadLogs]);

  const colors: Record<string, string> = {
    info: "bg-success-100 text-success-700",
    warn: "bg-warning-100 text-warning-700",
    error: "bg-error-100 text-error-700",
  };

  return (
    <div className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
      <h2 className="text-xl font-semibold">Логи</h2>
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded border p-1"
          value={query.level || ""}
          onChange={(e) => setQuery({ ...query, level: e.target.value })}
        >
          <option value="">Все уровни</option>
          <option value="debug">debug</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
          <option value="log">log</option>
        </select>
        <input
          className="rounded border p-1"
          placeholder="Содержит текст"
          value={query.message || ""}
          onChange={(e) => setQuery({ ...query, message: e.target.value })}
        />
        <input
          type="date"
          className="rounded border p-1"
          value={query.from || ""}
          onChange={(e) => setQuery({ ...query, from: e.target.value })}
        />
        <input
          type="date"
          className="rounded border p-1"
          value={query.to || ""}
          onChange={(e) => setQuery({ ...query, to: e.target.value })}
        />
        <select
          className="rounded border p-1"
          value={query.sort || "-createdAt"}
          onChange={(e) => setQuery({ ...query, sort: e.target.value })}
        >
          <option value="-createdAt">Новые сверху</option>
          <option value="date_asc">Старые сверху</option>
        </select>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left">Уровень</th>
            <th className="text-left">Время</th>
            <th className="text-left">Сообщение</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l._id} className="border-b last:border-b-0">
              <td>
                <span
                  className={`rounded px-2 py-0.5 ${colors[l.level] || "bg-gray-100 text-gray-700"}`}
                >
                  {l.level.toUpperCase()}
                </span>
              </td>
              <td>{new Date(l.createdAt).toLocaleString()}</td>
              <td className="whitespace-pre-wrap">{l.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
