// Назначение файла: универсальная таблица задач на AG Grid
// Модули: React, ag-grid, утилиты, useGrid
import React from "react";
import { AgGridReact } from "ag-grid-react";
import type {
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from "ag-grid-community";
import useGrid from "../hooks/useGrid";
import taskColumns from "../columns/taskColumns";

type Coords = { lat: number; lng: number };

interface Task {
  _id: string;
  request_id?: string;
  title: string;
  status?: string;
  priority?: string;
  start_date?: string;
  due_date?: string;
  task_type?: string;
  assignees?: number[];
  assigned_user_id?: number;
  startCoordinates?: Coords;
  finishCoordinates?: Coords;
  route_distance_km?: number;
  createdAt?: string;
}

interface TaskTableProps {
  tasks: Task[];
  users?: Record<number, any>;
  onSelectionChange?: (ids: string[]) => void;
  onDataChange?: (rows: Task[]) => void;
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
    const rows: Task[] = [];
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
    const ids = apiRef.current.getSelectedRows().map((r: Task) => r._id);
    onSelectionChange(ids);
  }, [onSelectionChange]);

  const exportCsv = React.useCallback(() => {
    apiRef.current?.exportDataAsCsv();
  }, []);

  return (
    <div className="space-y-2">
      <button onClick={exportCsv} className="btn-gray rounded px-3">
        Экспорт CSV
      </button>
      <div className="ag-theme-alpine" style={{ height: 500 }}>
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
      </div>
    </div>
  );
}
