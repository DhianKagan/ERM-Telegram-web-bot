// Панель фильтров логов
// Модули: React
import React from "react";
import { LogFilters } from "../hooks/useLogsQuery";

interface Props {
  filters: LogFilters;
  onChange: (f: LogFilters) => void;
}

export default function FiltersPanel({ filters, onChange }: Props) {
  const noCsrfId = React.useId();
  return (
    <div className="flex flex-wrap gap-2">
      <select
        className="rounded border p-1"
        aria-label="Уровень"
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
        aria-label="Метод"
        value={filters.method || ""}
        onChange={(e) => onChange({ ...filters, method: e.target.value })}
      />
      <input
        className="rounded border p-1"
        placeholder="Endpoint"
        aria-label="Endpoint"
        value={filters.endpoint || ""}
        onChange={(e) => onChange({ ...filters, endpoint: e.target.value })}
      />
      <input
        className="rounded border p-1"
        placeholder="Статус"
        aria-label="Статус"
        value={filters.status || ""}
        onChange={(e) =>
          onChange({ ...filters, status: Number(e.target.value) || undefined })
        }
      />
      <input
        className="rounded border p-1"
        placeholder="Содержит текст"
        aria-label="Содержит текст"
        value={filters.message || ""}
        onChange={(e) => onChange({ ...filters, message: e.target.value })}
      />
      <input
        type="date"
        className="rounded border p-1"
        aria-label="От"
        value={filters.from || ""}
        onChange={(e) => onChange({ ...filters, from: e.target.value })}
      />
      <input
        type="date"
        className="rounded border p-1"
        aria-label="До"
        value={filters.to || ""}
        onChange={(e) => onChange({ ...filters, to: e.target.value })}
      />
      <div className="flex items-center gap-1 text-sm">
        <input
          id={noCsrfId}
          type="checkbox"
          checked={filters.noCsrf || false}
          onChange={(e) => onChange({ ...filters, noCsrf: e.target.checked })}
        />
        <label htmlFor={noCsrfId}>no-csrf</label>
      </div>
    </div>
  );
}
