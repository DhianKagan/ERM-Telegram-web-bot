// Назначение файла: универсальная таблица задач на AG Grid
// Модули: React, ag-grid, утилиты, useGrid
import React from "react";
const AgGridReact = React.lazy(() =>
  import("ag-grid-react").then((m) => ({ default: m.AgGridReact })),
);
import type {
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from "ag-grid-community";
import useGrid from "../hooks/useGrid";
import taskColumns from "../columns/taskColumns";
import type { Task } from "shared";

type TaskRow = Task & Record<string, any>;

interface TaskTableProps {
  tasks: TaskRow[];
  users?: Record<number, any>;
  onSelectionChange?: (ids: string[]) => void;
  onDataChange?: (rows: TaskRow[]) => void;
  quickFilterText?: string;
  selectable?: boolean;
  onRowClick?: (id: string) => void;
}

export default function TaskTable({
  tasks,
  users = {},
  onSelectionChange,
  onDataChange,
  quickFilterText,
  selectable = false,
  onRowClick,
}: TaskTableProps) {
  const apiRef = React.useRef<GridApi | null>(null);
  const columnDefs = React.useMemo(
    () => taskColumns(selectable, users),
    [selectable, users],
  );
  const { defaultColDef, gridOptions } = useGrid();

  const updateData = React.useCallback(() => {
    if (!apiRef.current || !onDataChange) return;
    const rows: TaskRow[] = [];
    apiRef.current.forEachNodeAfterFilterAndSort((n) => rows.push(n.data));
    onDataChange(rows);
  }, [onDataChange]);

  const onGridReady = React.useCallback(
    (e: GridReadyEvent) => {
      apiRef.current = e.api;
      updateData();
    },
    [updateData],
  );

  const onSel = React.useCallback(() => {
    if (!apiRef.current || !onSelectionChange) return;
    const ids = apiRef.current.getSelectedRows().map((r: TaskRow) => r._id);
    onSelectionChange(ids);
  }, [onSelectionChange]);

  const exportCsv = React.useCallback(() => {
    apiRef.current?.exportDataAsCsv();
  }, []);

  return (
    <div className="space-y-2">
      <button
        onClick={exportCsv}
        className="btn btn-blue rounded px-3 hover:shadow-lg"
      >
        Экспорт CSV
      </button>
      <div className="ag-theme-alpine" style={{ height: 500 }}>
        <React.Suspense fallback={<div>Загрузка...</div>}>
          <AgGridReact
            rowData={tasks}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowSelection={
              selectable
                ? { mode: "multiRow", checkboxes: true, headerCheckbox: true }
                : undefined
            }
            onSelectionChanged={onSel}
            onGridReady={onGridReady}
            onSortChanged={updateData}
            onFilterChanged={updateData}
            onRowClicked={(e) => onRowClick && onRowClick(e.data._id)}
            quickFilterText={quickFilterText}
            {...gridOptions}
          />
        </React.Suspense>
      </div>
    </div>
  );
}
