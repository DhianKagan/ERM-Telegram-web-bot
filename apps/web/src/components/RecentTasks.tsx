// Таблица последних задач на React Table
// Модули: React, authFetch, DataTable, recentTaskColumns
import React, { useEffect, useState } from "react";
import authFetch from "../utils/authFetch";
import DataTable from "./DataTable";
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
    <DataTable
      columns={recentTaskColumns}
      data={tasks}
      pageIndex={0}
      pageSize={5}
      onPageChange={() => {}}
    />
  );
}
