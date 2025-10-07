// Фильтры поиска задач
// Модули: React, shared, useTasks
import React from "react";
import { TASK_STATUSES, PRIORITIES } from "shared";
import useTasks from "../context/useTasks";

interface Props {
  inline?: boolean;
}

export default function SearchFilters({ inline = false }: Props) {
  const { filters, setFilters } = useTasks();
  const [local, setLocal] = React.useState(filters);

  const toFieldId = React.useCallback(
    (prefix: string, value: string) =>
      `${prefix}-${value}`
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, ""),
    [],
  );

  const toggle = (key: "status" | "priority", value: string) => {
    setLocal((prev) => {
      const arr = prev[key];
      const exists = arr.includes(value);
      const next = exists ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...prev, [key]: next };
    });
  };

  const content = (
    <div className="flex w-52 flex-col gap-1.5 text-sm">
      <div>
        <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
          Статус
        </span>
        {TASK_STATUSES.map((s) => {
          const fieldId = toFieldId("status", s);
          return (
            <label
              key={s}
              className="flex items-center gap-1 text-[13px]"
              htmlFor={fieldId}
            >
              <input
                id={fieldId}
                name="status[]"
                type="checkbox"
                checked={local.status.includes(s)}
                onChange={() => toggle("status", s)}
              />
              {s}
            </label>
          );
        })}
      </div>
      <div>
        <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
          Приоритет
        </span>
        {PRIORITIES.map((p) => {
          const fieldId = toFieldId("priority", p);
          return (
            <label
              key={p}
              className="flex items-center gap-1 text-[13px]"
              htmlFor={fieldId}
            >
              <input
                id={fieldId}
                name="priority[]"
                type="checkbox"
                checked={local.priority.includes(p)}
                onChange={() => toggle("priority", p)}
              />
              {p}
            </label>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          className="rounded border px-1.5 py-1 text-[13px]"
          name="from"
          value={local.from}
          onChange={(e) => setLocal({ ...local, from: e.target.value })}
        />
        <input
          type="date"
          className="rounded border px-1.5 py-1 text-[13px]"
          name="to"
          value={local.to}
          onChange={(e) => setLocal({ ...local, to: e.target.value })}
        />
      </div>
      <button
        onClick={() => setFilters(local)}
        className="mt-1.5 rounded border px-1.5 py-1 text-[13px]"
      >
        Искать
      </button>
    </div>
  );

  if (inline) return content;

  return (
    <details className="relative">
      <summary className="cursor-pointer rounded border px-1.5 py-0.5 select-none text-sm">
        Фильтры
      </summary>
      <div className="absolute z-10 mt-1 rounded border bg-white p-1.5 shadow">
        {content}
      </div>
    </details>
  );
}
