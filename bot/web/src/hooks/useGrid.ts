// Сервис useGrid предоставляет типовые настройки AG Grid
// Модули: React, ag-grid
import React from "react";
import type { ColDef, GridOptions } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

export default function useGrid<T = any>(options: GridOptions<T> = {}) {
  const defaultColDef = React.useMemo<ColDef>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      floatingFilter: true,
    }),
    [],
  );

  const gridOptions = React.useMemo<GridOptions<T>>(
    () => ({ pagination: true, paginationPageSize: 25, ...options }),
    [options],
  );

  return { defaultColDef, gridOptions };
}
