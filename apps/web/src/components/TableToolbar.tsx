// Назначение файла: общий тулбар таблицы с экспортом, поиском и фильтрацией
// Модули: React, @tanstack/react-table, jspdf
import React from "react";
import type { Table } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import GlobalSearch from "./GlobalSearch";
import SearchFilters from "./SearchFilters";

interface Props<T> {
  table: Table<T>;
  children?: React.ReactNode;
}

export default function TableToolbar<T>({ table, children }: Props<T>) {
  const columns = table.getAllLeafColumns();
  const { t } = useTranslation();

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

  const exportPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    await import("jspdf-autotable");
    const headers = columns
      .filter((c) => c.getIsVisible())
      .map((c) => c.columnDef.header as string);
    const rows = table
      .getRowModel()
      .rows.map((r) =>
        r.getVisibleCells().map((c) => String(c.getValue() ?? "")),
      );
    const doc = new jsPDF();
    (doc as any).autoTable({ head: [headers], body: rows });
    doc.save("table.pdf");
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
    <div className="flex w-full flex-wrap items-center gap-2 text-sm">
      <div className="flex items-center gap-2">
        <GlobalSearch />
        {children}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <details className="relative">
          <summary className="cursor-pointer rounded border px-2 py-1 select-none">
            {t("export")}
          </summary>
          <div className="absolute right-0 z-10 mt-1 w-32 rounded border bg-white p-2 shadow">
            <button
              onClick={exportCsv}
              className="block w-full rounded px-2 py-1 text-left hover:bg-gray-100"
            >
              CSV
            </button>
            <button
              onClick={() => void exportPdf()}
              className="mt-1 block w-full rounded px-2 py-1 text-left hover:bg-gray-100"
            >
              PDF
            </button>
          </div>
        </details>
        <details className="relative">
          <summary className="cursor-pointer rounded border px-2 py-1 select-none">
            {t("settings")}
          </summary>
          <div className="absolute right-0 z-10 mt-1 w-64 space-y-2 rounded border bg-white p-2 shadow">
            <SearchFilters inline />
            <div className="border-t pt-2">
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
          </div>
        </details>
      </div>
    </div>
  );
}
