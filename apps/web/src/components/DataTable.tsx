// Назначение файла: универсальная таблица на React Table с серверной пагинацией
// Модули: React, @tanstack/react-table, ui/table, TableToolbar
import React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  Table as TableType,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import TableToolbar from "./TableToolbar";

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  pageIndex: number;
  pageSize: number;
  pageCount?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onRowClick?: (row: T) => void;
  toolbarChildren?: React.ReactNode;
  showGlobalSearch?: boolean;
  showFilters?: boolean;
  wrapCellsAsBadges?: boolean;
  badgeClassName?: string;
  badgeWrapperClassName?: string;
}

interface ColumnMeta {
  minWidth?: string;
  maxWidth?: string;
  width?: string;
  cellClassName?: string;
  headerClassName?: string;
}

export const defaultBadgeClassName =
  "inline-flex min-h-[1.75rem] max-w-full items-center justify-start gap-1 rounded-full border border-slate-200 bg-white px-3 py-0.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:ring-slate-700/60";
export const defaultBadgeWrapperClassName = "flex flex-wrap items-center gap-2";

const extractBadgeItems = (value: React.ReactNode): string[] => {
  const items: string[] = [];
  const visit = (node: React.ReactNode) => {
    if (node === null || node === undefined || node === false) return;
    if (typeof node === "string" || typeof node === "number") {
      const text = String(node).trim();
      if (!text) return;
      const parts = text
        .split(/[,\n;]/)
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length) {
        items.push(...parts);
      } else {
        items.push(text);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (React.isValidElement(node)) {
      visit(node.props.children);
      return;
    }
    const fallback = String(node).trim();
    if (fallback) items.push(fallback);
  };
  visit(value);
  return items;
};

const renderBadgeContent = (
  content: React.ReactNode,
  badgeClassName: string,
  wrapperClassName: string,
) => {
  const items = extractBadgeItems(content);
  if (!items.length) {
    return <span className={badgeClassName}>—</span>;
  }
  if (items.length === 1) {
    return (
      <span className={badgeClassName} title={items[0]}>
        {items[0]}
      </span>
    );
  }
  return (
    <div className={wrapperClassName}>
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className={badgeClassName} title={item}>
          {item}
        </span>
      ))}
    </div>
  );
};

export default function DataTable<T>({
  columns,
  data,
  pageIndex,
  pageSize,
  pageCount,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  toolbarChildren,
  showGlobalSearch = true,
  showFilters = true,
  wrapCellsAsBadges = false,
  badgeClassName = defaultBadgeClassName,
  badgeWrapperClassName = defaultBadgeWrapperClassName,
}: DataTableProps<T>) {
  const [columnVisibility, setColumnVisibility] = React.useState({});
  const [columnOrder, setColumnOrder] = React.useState<string[]>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      columnVisibility,
      columnOrder,
      pagination: { pageIndex, pageSize },
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  });

  return (
    <div className="w-full space-y-1.5 px-0 font-ui text-[13px] sm:px-1.5 sm:text-sm">
      <TableToolbar
        table={table as TableType<T>}
        showGlobalSearch={showGlobalSearch}
        showFilters={showFilters}
      >
        {toolbarChildren}
      </TableToolbar>
      <Table className="text-left">
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} variant="header">
              {hg.headers.map((header) => {
                const meta =
                  (header.column.columnDef.meta as ColumnMeta | undefined) ||
                  {};
                const baseSize = header.getSize();
                const computedWidth =
                  typeof meta.width === "string"
                    ? meta.width
                    : Number.isFinite(baseSize)
                    ? `${baseSize}px`
                    : undefined;
                const headerClassName = [
                  "break-words whitespace-normal",
                  meta.headerClassName,
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <TableHead
                    key={header.id}
                    style={{
                      width: computedWidth,
                      minWidth: meta.minWidth ?? "4rem",
                      maxWidth: meta.maxWidth ?? "16rem",
                    }}
                    className={headerClassName}
                    // фиксируем ширину ячейки заголовка
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              onClick={() => onRowClick?.(row.original)}
              className="cursor-pointer"
            >
              {row.getVisibleCells().map((cell) => {
                const meta =
                  (cell.column.columnDef.meta as ColumnMeta | undefined) || {};
                const baseSize = cell.column.getSize();
                const computedWidth =
                  typeof meta.width === "string"
                    ? meta.width
                    : Number.isFinite(baseSize)
                    ? `${baseSize}px`
                    : undefined;
                const cellClassName = [
                  "break-words whitespace-normal align-top",
                  meta.cellClassName,
                ]
                  .filter(Boolean)
                  .join(" ");
                const cellContent = flexRender(
                  cell.column.columnDef.cell,
                  cell.getContext(),
                );
                return (
                  <TableCell
                    key={cell.id}
                    style={{
                      width: computedWidth,
                      minWidth: meta.minWidth ?? "4rem",
                      maxWidth: meta.maxWidth ?? "16rem",
                    }}
                    className={cellClassName}
                    // фиксируем ширину ячейки данных
                  >
                    {wrapCellsAsBadges
                      ? renderBadgeContent(
                          cellContent,
                          badgeClassName,
                          badgeWrapperClassName,
                        )
                      : cellContent}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
            disabled={pageIndex === 0}
            className="rounded border px-1.5 py-1 font-medium disabled:opacity-50"
          >
            Назад
          </button>
          <span className="px-1">
            Стр. {pageIndex + 1}
            {pageCount ? ` / ${pageCount}` : ""}
          </span>
          <button
            onClick={() =>
              onPageChange(
                pageCount
                  ? Math.min(pageCount - 1, pageIndex + 1)
                  : pageIndex + 1,
              )
            }
            disabled={pageCount ? pageIndex + 1 >= pageCount : false}
            className="rounded border px-1.5 py-1 font-medium disabled:opacity-50"
          >
            Вперёд
          </button>
        </div>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 min-w-[4rem] rounded border px-1.5 text-xs sm:text-sm"
          >
            {[10, 25, 50].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
