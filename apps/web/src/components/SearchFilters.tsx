// Фильтры поиска задач
// Модули: React, shared, useTasks
import React from "react";
import { TASK_STATUSES, PRIORITIES } from "shared";
import useTasks from "../context/useTasks";

export default function SearchFilters() {
  const { filters, setFilters } = useTasks();
  const [local, setLocal] = React.useState(filters);

  const toggle = (key: "status" | "priority", value: string) => {
    setLocal((prev) => {
      const arr = prev[key];
      const exists = arr.includes(value);
      const next = exists ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...prev, [key]: next };
    });
  };

  return (
    <details className="relative">
      <summary className="cursor-pointer rounded border px-2 py-1 select-none">
        Фильтры
      </summary>
      <div className="absolute z-10 mt-1 flex w-64 flex-col gap-2 rounded border bg-white p-2 shadow">
        <div>
          <span className="block text-sm font-medium">Статус</span>
          {TASK_STATUSES.map((s) => (
            <label key={s} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={local.status.includes(s)}
                onChange={() => toggle("status", s)}
              />
              {s}
            </label>
          ))}
        </div>
        <div>
          <span className="block text-sm font-medium">Приоритет</span>
          {PRIORITIES.map((p) => (
            <label key={p} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={local.priority.includes(p)}
                onChange={() => toggle("priority", p)}
              />
              {p}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="rounded border p-1"
            value={local.from}
            onChange={(e) => setLocal({ ...local, from: e.target.value })}
          />
          <input
            type="date"
            className="rounded border p-1"
            value={local.to}
            onChange={(e) => setLocal({ ...local, to: e.target.value })}
          />
        </div>
        <button
          onClick={() => setFilters(local)}
          className="mt-2 rounded border px-2 py-1"
        >
          Искать
        </button>
      </div>
    </details>
  );
}
