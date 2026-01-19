// Назначение файла: общий тулбар таблицы с экспортом, поиском и фильтрацией
// Модули: React, @tanstack/react-table, jspdf
import React from 'react';
import type { Table } from '@tanstack/react-table';
import type JsPDFClass from 'jspdf';
import type { UserOptions as AutoTableOptions } from 'jspdf-autotable';
import { useTranslation } from 'react-i18next';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import GlobalSearch from './GlobalSearch';
import SearchFilters from './SearchFilters';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t('settings')}
            >
              <EllipsisVerticalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel>Управление</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Экспорт</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  onSelect={() => {
                    exportCsv();
                  }}
                >
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void exportPdf();
                  }}
                >
                  PDF
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Настройки</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-72">
                {showFilters ? (
                  <div className="px-2 py-1.5">
                    <SearchFilters inline />
                  </div>
                ) : null}
                <div className="border-t border-border pt-2">
                  {columns.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={col.getIsVisible()}
                      onSelect={(event) => {
                        event.preventDefault();
                        toggleColumn(col.id);
                      }}
                    >
                      {col.columnDef.header as string}
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Сортировка</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-64">
                {columns.map((col) => (
                  <div
                    key={col.id}
                    className="flex items-center justify-between gap-2 px-2 py-1"
                  >
                    <span className="text-xs font-medium text-muted-foreground">
                      {col.columnDef.header as string}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveColumn(col.id, -1)}
                        className="rounded border border-border px-2 text-xs font-medium leading-none text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => moveColumn(col.id, 1)}
                        className="rounded border border-border px-2 text-xs font-medium leading-none text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        →
                      </button>
                    </div>
                  </div>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
