// Сервис useGrid предоставляет типовые настройки AG Grid
// Модули: React, ag-grid
import React from "react";
import type { ColDef, GridOptions } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

export default function useGrid<T = any>(options: GridOptions<T> = {}) {
  const objectFormatter = React.useCallback((p: any) => {
    const val: unknown = p.value;
    if (val && typeof val === "object") {
      const obj = val as Record<string, unknown>;
      return typeof obj.name === "string" ? obj.name : JSON.stringify(obj);
    }
    return (val as string | number | undefined) ?? "";
  }, []);

  const defaultColDef = React.useMemo<ColDef>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      floatingFilter: true,
      valueFormatter: objectFormatter,
    }),
    [objectFormatter],
  );

  const dataTypeDefinitions = React.useMemo(
    () => ({
      object: {
        baseDataType: "object",
        extendsDataType: "object",
        valueFormatter: objectFormatter,
      },
    }),
    [objectFormatter],
  );

  const gridOptions = React.useMemo<GridOptions<T>>(
    () => ({
      pagination: true,
      paginationPageSize: 25,
      paginationPageSizeSelector: [25, 50, 100],
      dataTypeDefinitions,
      ...options,
    }),
    [options, dataTypeDefinitions],
  );

  return { defaultColDef, gridOptions };
}
