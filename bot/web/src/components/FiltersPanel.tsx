// Панель фильтров логов
// Модули: React
import React from "react";
import { LogFilters } from "../hooks/useLogsQuery";

interface Props {
  filters: LogFilters;
  onChange: (f: LogFilters) => void;
}

export default function FiltersPanel({ filters, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <select
        className="rounded border p-1"
        value={filters.level || ""}
        onChange={(e) => onChange({ ...filters, level: e.target.value })}
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
        placeholder="Метод"
        value={filters.method || ""}
        onChange={(e) => onChange({ ...filters, method: e.target.value })}
      />
      <input
        className="rounded border p-1"
        placeholder="Endpoint"
        value={filters.endpoint || ""}
        onChange={(e) => onChange({ ...filters, endpoint: e.target.value })}
      />
      <input
        className="rounded border p-1"
        placeholder="Статус"
        value={filters.status || ""}
        onChange={(e) =>
          onChange({ ...filters, status: Number(e.target.value) || undefined })
        }
      />
      <input
        className="rounded border p-1"
        placeholder="Содержит текст"
        value={filters.message || ""}
        onChange={(e) => onChange({ ...filters, message: e.target.value })}
      />
      <input
        type="date"
        className="rounded border p-1"
        value={filters.from || ""}
        onChange={(e) => onChange({ ...filters, from: e.target.value })}
      />
      <input
        type="date"
        className="rounded border p-1"
        value={filters.to || ""}
        onChange={(e) => onChange({ ...filters, to: e.target.value })}
      />
      <label className="flex items-center gap-1 text-sm">
        <input
          type="checkbox"
          checked={filters.noCsrf || false}
          onChange={(e) => onChange({ ...filters, noCsrf: e.target.checked })}
        />
        no-csrf
      </label>
    </div>
  );
}
