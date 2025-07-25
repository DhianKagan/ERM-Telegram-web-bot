// Компонент просмотра логов с таблицей и экспортом
// Модули: React, useLogsQuery, FiltersPanel
import React from "react";
import useLogsQuery, { LogFilters } from "../hooks/useLogsQuery";
import FiltersPanel from "./FiltersPanel";

export default function LogViewer() {
  const [filters, setFilters] = React.useState<LogFilters>({});
  const [live, setLive] = React.useState(true);
  const logs = useLogsQuery(filters);

  React.useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setFilters({ ...filters }), 5000);
    return () => clearInterval(id);
  }, [live, filters]);

  const exportCsv = () => {
    const rows = logs.map((l) =>
      [l.time, l.level, l.method, l.status, l.endpoint, l.message].join(","),
    );
    const blob = new Blob(
      ["time,level,method,status,endpoint,message\n", ...rows],
      {
        type: "text/csv",
      },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "logs.csv";
    a.click();
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "logs.json";
    a.click();
  };

  const colors: Record<string, string> = {
    info: "text-success-600",
    warn: "text-warning-600",
    error: "text-error-600",
    debug: "text-gray-500",
    log: "text-gray-500",
  };

  return (
    <div className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Логи</h2>
        <div className="flex gap-2 text-sm">
          <button onClick={exportCsv} className="rounded border px-2 py-1">
            CSV
          </button>
          <button onClick={exportJson} className="rounded border px-2 py-1">
            JSON
          </button>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={live}
              onChange={(e) => setLive(e.target.checked)}
            />
            Live
          </label>
        </div>
      </div>
      <FiltersPanel filters={filters} onChange={setFilters} />
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="text-left">Уровень</th>
              <th className="text-left">Время</th>
              <th className="text-left">Метод</th>
              <th className="text-left">Статус</th>
              <th className="text-left">Endpoint</th>
              <th className="text-left">Сообщение</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i} className="border-b last:border-b-0">
                <td className={colors[l.level] || ""}>{l.level}</td>
                <td>{l.time}</td>
                <td>{l.method}</td>
                <td>{l.status}</td>
                <td>{l.endpoint}</td>
                <td className="whitespace-pre-wrap">{l.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
