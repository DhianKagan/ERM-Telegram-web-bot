// Таблица последних задач на AG Grid
// Модули: React, authFetch, ag-grid, useGrid
import React, { useEffect, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import authFetch from "../utils/authFetch";
import useGrid from "../hooks/useGrid";
import recentTaskColumns from "../columns/recentTaskColumns";

interface Task {
  _id: string;
  title: string;
  status: string;
  task_number: string;
  createdAt: string;
}

export default function RecentTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { defaultColDef, gridOptions } = useGrid({ paginationPageSize: 5 });
  useEffect(() => {
    authFetch("/api/v1/tasks?limit=5")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : data.tasks || data.items || [];
        setTasks(list);
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
      <AgGridReact
        rowData={tasks}
        columnDefs={recentTaskColumns}
        defaultColDef={defaultColDef}
        {...gridOptions}
      />
    </div>
  );
}
