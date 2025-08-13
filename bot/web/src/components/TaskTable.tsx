// Назначение файла: универсальная таблица задач на AG Grid
// Модули: React, ag-grid, утилиты
import React from "react";
import { AgGridReact } from "ag-grid-react";
import type {
  ColDef,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import userLink from "../utils/userLink";

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

  const columnDefs = React.useMemo<ColDef[]>(
    () => [
      {
        headerName: "Задача",
        field: "title",
        checkboxSelection: selectable,
        headerCheckboxSelection: selectable,
        valueGetter: (p) =>
          `${p.data.request_id || ""} ${p.data.createdAt?.slice(0, 10) || ""} ${
            p.data.title?.replace(/^ERM_\d+\s*/, "") || ""
          }`,
      },
      { headerName: "Статус", field: "status" },
      { headerName: "Приоритет", field: "priority" },
      { headerName: "Начало", field: "start_date" },
      { headerName: "Срок", field: "due_date" },
      { headerName: "Тип", field: "task_type" },
      {
        headerName: "Старт",
        field: "startCoordinates",
        valueGetter: (p) =>
          p.data.startCoordinates
            ? `${p.data.startCoordinates.lat}, ${p.data.startCoordinates.lng}`
            : "",
      },
      {
        headerName: "Финиш",
        field: "finishCoordinates",
        valueGetter: (p) =>
          p.data.finishCoordinates
            ? `${p.data.finishCoordinates.lat}, ${p.data.finishCoordinates.lng}`
            : "",
      },
      { headerName: "Км", field: "route_distance_km" },
      {
        headerName: "Исполнители",
        field: "assignees",
        cellRenderer: (p: any) => {
          const ids =
            p.data.assignees ||
            (p.data.assigned_user_id ? [p.data.assigned_user_id] : []);
          return ids.map((id: number) => (
            <span
              key={id}
              dangerouslySetInnerHTML={{
                __html: userLink(
                  id,
                  users[id]?.name ||
                    users[id]?.telegram_username ||
                    users[id]?.username ||
                    String(id),
                ),
              }}
              className="mr-1"
            />
          ));
        },
      },
    ],
    [selectable, users],
  );

  const defaultColDef = React.useMemo<ColDef>(
    () => ({ sortable: true, filter: true, resizable: true }),
    [],
  );

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
          rowSelection={selectable ? "multiple" : undefined}
          onSelectionChanged={onSel}
          onGridReady={onGridReady}
          onSortChanged={updateData}
          onFilterChanged={updateData}
          onRowClicked={(e) => onRowClick && onRowClick(e.data._id)}
          pagination
          quickFilterText={quickFilterText}
        />
      </div>
    </div>
  );
}
