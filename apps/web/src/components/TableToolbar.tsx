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
    <div className="ui-filter-row text-xs sm:text-sm">
      <div className="ui-filter-row__inputs">
        {showGlobalSearch ? <GlobalSearch /> : null}
        {children}
      </div>
      <div className="ui-filter-row__actions">
        <details className="group relative flex-shrink-0">
          <summary className="cursor-pointer select-none rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold leading-tight text-[var(--color-muted)] shadow-[var(--shadow-sm)] transition hover:bg-[var(--bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]">
            {t('export')}
          </summary>
          <div className="absolute right-0 top-full z-10 w-36 min-w-full space-y-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] p-2 shadow-[var(--shadow-sm)]">
            <button
              onClick={exportCsv}
              className="block w-full rounded-[var(--radius)] px-2 py-1 text-left text-xs font-medium text-[var(--color-muted)] transition hover:bg-[var(--bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]"
            >
              CSV
            </button>
            <button
              onClick={() => void exportPdf()}
              className="block w-full rounded-[var(--radius)] px-2 py-1 text-left text-xs font-medium text-[var(--color-muted)] transition hover:bg-[var(--bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]"
            >
              PDF
            </button>
          </div>
        </details>
        <details className="group relative flex-shrink-0">
          <summary className="cursor-pointer select-none rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold leading-tight text-[var(--color-muted)] shadow-[var(--shadow-sm)] transition hover:bg-[var(--bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]">
            {t('settings')}
          </summary>
          <div className="absolute right-0 top-full z-10 w-72 min-w-full space-y-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-sm)]">
            {showFilters ? <SearchFilters inline /> : null}
            <div className="border-t border-[var(--border)] pt-2">
              {columns.map((col) => (
                <div
                  key={col.id}
                  className="flex items-center justify-between gap-2 py-1"
                >
                  <label
                    className="flex items-center gap-2 text-xs font-medium sm:text-sm"
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
                      className="rounded-[6px] border border-[var(--border)] px-2 text-xs font-medium leading-none text-[var(--color-muted)] transition hover:bg-[var(--bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => moveColumn(col.id, 1)}
                      className="rounded-[6px] border border-[var(--border)] px-2 text-xs font-medium leading-none text-[var(--color-muted)] transition hover:bg-[var(--bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]"
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
