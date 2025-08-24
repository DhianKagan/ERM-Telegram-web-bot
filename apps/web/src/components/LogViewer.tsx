// Компонент просмотра логов на AG Grid и экспортом
// Модули: React, useLogsQuery, FiltersPanel, ag-grid, useGrid
import React from "react";
const AgGridReact = React.lazy(() =>
  import("ag-grid-react").then((m) => ({ default: m.AgGridReact })),
);
import useLogsQuery, { LogFilters } from "../hooks/useLogsQuery";
import FiltersPanel from "./FiltersPanel";
import useGrid from "../hooks/useGrid";
import logColumns from "../columns/logColumns";

export default function LogViewer() {
  const [filters, setFilters] = React.useState<LogFilters>({});
  const [live, setLive] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const logs = useLogsQuery(filters, page);
  const { defaultColDef, gridOptions } = useGrid({ pagination: false });

  React.useEffect(() => {
    setPage(1);
  }, [filters]);

  React.useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setFilters({ ...filters }), 5000);
    return () => clearInterval(id);
  }, [live, filters, page]);

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
      <div className="ag-theme-alpine" style={{ height: 500 }}>
        <React.Suspense fallback={<div>Загрузка...</div>}>
          <AgGridReact
            rowData={logs}
            columnDefs={logColumns}
            defaultColDef={defaultColDef}
            {...gridOptions}
          />
        </React.Suspense>
      </div>
      <div className="flex justify-between text-sm">
        <button
          className="rounded border px-2 py-1"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Назад
        </button>
        <span>Страница {page}</span>
        <button
          className="rounded border px-2 py-1"
          onClick={() => setPage((p) => p + 1)}
        >
          Вперёд
        </button>
      </div>
    </div>
  );
}
