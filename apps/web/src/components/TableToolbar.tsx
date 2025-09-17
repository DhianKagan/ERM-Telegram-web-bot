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
    <div className="flex w-full flex-wrap items-center gap-1.5 text-xs sm:text-sm">
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        <GlobalSearch />
        {children}
      </div>
      <div className="ml-auto flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
        <details className="relative">
          <summary className="cursor-pointer rounded border px-2 py-1 text-xs font-medium select-none sm:text-sm">
            {t("export")}
          </summary>
          <div className="absolute right-0 z-10 mt-1 w-32 rounded border bg-white p-1.5 shadow">
            <button
              onClick={exportCsv}
              className="block w-full rounded px-2 py-1 text-left text-xs font-medium hover:bg-gray-100 sm:text-sm"
            >
              CSV
            </button>
            <button
              onClick={() => void exportPdf()}
              className="mt-1 block w-full rounded px-2 py-1 text-left text-xs font-medium hover:bg-gray-100 sm:text-sm"
            >
              PDF
            </button>
          </div>
        </details>
        <details className="relative">
          <summary className="cursor-pointer rounded border px-2 py-1 text-xs font-medium select-none sm:text-sm">
            {t("settings")}
          </summary>
          <div className="absolute right-0 z-10 mt-1 w-64 space-y-1.5 rounded border bg-white p-2 shadow">
            <SearchFilters inline />
            <div className="border-t pt-1.5">
              {columns.map((col) => (
                <div
                  key={col.id}
                  className="flex items-center justify-between gap-1.5"
                >
                  <label className="flex items-center gap-1 text-xs font-medium sm:text-sm">
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
                      className="rounded border px-1 text-xs font-medium"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => moveColumn(col.id, 1)}
                      className="rounded border px-1 text-xs font-medium"
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
