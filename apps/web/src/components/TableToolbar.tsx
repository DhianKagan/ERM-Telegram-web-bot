// Назначение файла: общий тулбар таблицы с экспортом, поиском и фильтрацией
// Модули: React, @tanstack/react-table, jspdf
import React from 'react';
import type { Table } from '@tanstack/react-table';
import type JsPDFClass from 'jspdf';
import type { UserOptions as AutoTableOptions } from 'jspdf-autotable';
import { useTranslation } from 'react-i18next';
import GlobalSearch from './GlobalSearch';
import SearchFilters from './SearchFilters';

interface Props<T> {
  table: Table<T>;
  children?: React.ReactNode;
  showGlobalSearch?: boolean;
  showFilters?: boolean;
}

type JsPdfWithAutoTable = InstanceType<typeof JsPDFClass> & {
  autoTable: (options: AutoTableOptions) => void;
};

export default function TableToolbar<T>({
  table,
  children,
  showGlobalSearch = true,
  showFilters = true,
}: Props<T>) {
  const columns = table.getAllLeafColumns();
  const { t } = useTranslation();

  const exportCsv = () => {
    const headers = columns
      .filter((c) => c.getIsVisible())
      .map((c) => c.columnDef.header as string);
    const rows = table
      .getRowModel()
      .rows.map((r) =>
        r.getVisibleCells().map((c) => String(c.getValue() ?? '')),
      );
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'table.csv';
    a.click();
  };

  const exportPdf = async () => {
    const pdfEntry = 'jspdf';
    const autoTableEntry = 'jspdf-autotable';
    const { default: jsPDF } = await import(/* @vite-ignore */ pdfEntry);
    await import(/* @vite-ignore */ autoTableEntry);
    const headers = columns
      .filter((c) => c.getIsVisible())
      .map((c) => c.columnDef.header as string);
    const rows = table
      .getRowModel()
      .rows.map((r) =>
        r.getVisibleCells().map((c) => String(c.getValue() ?? '')),
      );
    const doc = new jsPDF() as JsPdfWithAutoTable;
    doc.autoTable({ head: [headers], body: rows });
    doc.save('table.pdf');
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
    <div className="flex w-full flex-wrap items-center gap-1 text-xs sm:text-sm">
      <div className="flex flex-1 flex-wrap items-center gap-1">
        {showGlobalSearch ? <GlobalSearch /> : null}
        {children}
      </div>
      <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto">
        <details className="group relative flex-shrink-0">
          <summary className="cursor-pointer rounded-t-md rounded-b-none border border-b-0 border-gray-200 bg-white px-2 py-1 text-xs font-semibold leading-tight text-gray-700 shadow-sm transition-colors select-none hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 group-open:border-gray-200 sm:text-sm">
            {t('export')}
          </summary>
          <div className="absolute left-0 top-full z-10 w-32 min-w-full rounded-b-md border border-t border-gray-200 bg-white p-1 shadow-sm">
            <button
              onClick={exportCsv}
              className="block w-full rounded px-1.5 py-1 text-left text-xs font-medium transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 sm:text-sm"
            >
              CSV
            </button>
            <button
              onClick={() => void exportPdf()}
              className="mt-1 block w-full rounded px-1.5 py-1 text-left text-xs font-medium transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 sm:text-sm"
            >
              PDF
            </button>
          </div>
        </details>
        <details className="group relative flex-shrink-0">
          <summary className="cursor-pointer rounded-t-md rounded-b-none border border-b-0 border-gray-200 bg-white px-2 py-1 text-xs font-semibold leading-tight text-gray-700 shadow-sm transition-colors select-none hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 group-open:border-gray-200 sm:text-sm">
            {t('settings')}
          </summary>
          <div className="absolute left-0 top-full z-10 w-64 min-w-full space-y-1 rounded-b-md border border-t border-gray-200 bg-white p-1.5 shadow-sm">
            {showFilters ? <SearchFilters inline /> : null}
            <div className="border-t pt-1">
              {columns.map((col) => (
                <div
                  key={col.id}
                  className="flex items-center justify-between gap-1"
                >
                  <label
                    className="flex items-center gap-1 text-xs font-medium sm:text-sm"
                    htmlFor={`table-column-${col.id}`}
                  >
                    <input
                      id={`table-column-${col.id}`}
                      name={`column-${col.id}`}
                      type="checkbox"
                      checked={col.getIsVisible()}
                      onChange={() => toggleColumn(col.id)}
                    />
                    {col.columnDef.header as string}
                  </label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveColumn(col.id, -1)}
                      className="rounded border border-gray-200 px-1 text-xs font-medium leading-none text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => moveColumn(col.id, 1)}
                      className="rounded border border-gray-200 px-1 text-xs font-medium leading-none text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
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
