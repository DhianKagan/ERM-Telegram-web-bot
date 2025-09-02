// Назначение файла: общий тулбар таблицы с экспортом и настройкой колонок
// Модули: React, @tanstack/react-table
import React from "react";
import type { Table } from "@tanstack/react-table";

interface Props<T> {
  table: Table<T>;
}

export default function TableToolbar<T>({ table }: Props<T>) {
  const columns = table.getAllLeafColumns();

  const exportCsv = () => {
    const headers = columns
      .filter((c) => c.getIsVisible())
      .map((c) => c.columnDef.header as string);
    const rows = table
      .getRowModel()
      .rows.map((r) =>
        r.getVisibleCells().map((c) => String(c.getValue() ?? "")),
      );
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "table.csv";
    a.click();
  };

  const toggleColumn = (id: string) => {
    const col = table.getColumn(id);
    if (col) col.toggleVisibility();
  };

  const moveColumn = (id: string, dir: number) => {
    const order = table.getState().columnOrder;
    const idx = order.indexOf(id);
    if (idx === -1) return;
    const next = idx + dir;
    if (next < 0 || next >= order.length) return;
    const newOrder = [...order];
    [newOrder[idx], newOrder[next]] = [newOrder[next], newOrder[idx]];
    table.setColumnOrder(newOrder);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button onClick={exportCsv} className="rounded border px-2 py-1">
        CSV
      </button>
      <details className="relative">
        <summary className="cursor-pointer rounded border px-2 py-1 select-none">
          Колонки
        </summary>
        <div className="absolute z-10 mt-1 w-48 rounded border bg-white p-2 shadow">
          {columns.map((col) => (
            <div
              key={col.id}
              className="flex items-center justify-between gap-2"
            >
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={col.getIsVisible()}
                  onChange={() => toggleColumn(col.id)}
                />
                {col.columnDef.header as string}
              </label>
              <div className="flex gap-1">
                <button
                  onClick={() => moveColumn(col.id, -1)}
                  className="rounded border px-1"
                >
                  ←
                </button>
                <button
                  onClick={() => moveColumn(col.id, 1)}
                  className="rounded border px-1"
                >
                  →
                </button>
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
