// Таблица последних задач на AG Grid
// Модули: React, authFetch, ag-grid, useGrid
import React, { useEffect, useState } from "react";
const AgGridReact = React.lazy(() =>
  import("ag-grid-react").then((m) => ({ default: m.AgGridReact })),
);
import authFetch from "../utils/authFetch";
import useGrid from "../hooks/useGrid";
import recentTaskColumns from "../columns/recentTaskColumns";
import type { Task } from "shared";

type RecentTask = Task & {
  status: string;
  task_number: string;
  createdAt: string;
};

export default function RecentTasks() {
  const [tasks, setTasks] = useState<RecentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const { defaultColDef, gridOptions } = useGrid({ paginationPageSize: 5 });
  useEffect(() => {
    authFetch("/api/v1/tasks?limit=5")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : data.tasks || data.items || [];
        setTasks(list as RecentTask[]);
        setLoading(false);
      })
      .catch(() => {
        setTasks([]);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-4 w-full animate-pulse rounded bg-gray-200"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="ag-theme-alpine" style={{ height: 200 }}>
      <React.Suspense fallback={<div>Загрузка...</div>}>
        <AgGridReact
          rowData={tasks}
          columnDefs={recentTaskColumns}
          defaultColDef={defaultColDef}
          {...gridOptions}
        />
      </React.Suspense>
    </div>
  );
}
