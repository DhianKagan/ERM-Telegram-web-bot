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
  onSelectionChange?: (rows: T[]) => void;
  onRowClick?: (row: T) => void;
}

export default function DataTable<T>({
  columns,
  data,
  pageIndex,
  pageSize,
  pageCount,
  onPageChange,
  onPageSizeChange,
  onSelectionChange,
  onRowClick,
}: DataTableProps<T>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState({});
  const [columnOrder, setColumnOrder] = React.useState<string[]>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      columnVisibility,
      columnOrder,
      pagination: { pageIndex, pageSize },
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  });

  React.useEffect(() => {
    if (onSelectionChange) {
      const selected = table.getSelectedRowModel().rows.map((r) => r.original);
      onSelectionChange(selected as T[]);
    }
  }, [rowSelection, table, onSelectionChange]);

  return (
    <div className="space-y-2">
      <TableToolbar table={table as TableType<T>} />
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className="max-w-[20rem] min-w-[4rem] overflow-hidden text-ellipsis whitespace-nowrap"
                  // фиксируем ширину ячейки заголовка
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() ? "selected" : undefined}
              onClick={() => onRowClick?.(row.original)}
              className="cursor-pointer"
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  style={{ width: cell.column.getSize() }}
                  className="max-w-[20rem] min-w-[4rem] overflow-hidden text-ellipsis whitespace-nowrap"
                  // фиксируем ширину ячейки данных
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
            disabled={pageIndex === 0}
            className="rounded border px-2 py-1 disabled:opacity-50"
          >
            Назад
          </button>
          <span>
            Страница {pageIndex + 1}
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
            className="rounded border px-2 py-1 disabled:opacity-50"
          >
            Вперёд
          </button>
        </div>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded border px-1"
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
