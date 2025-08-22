// Колонки для таблицы последних задач
// Модули: ag-grid
import type { ColDef } from "ag-grid-community";

const recentTaskColumns: ColDef[] = [
  { headerName: "Номер", field: "task_number" },
  {
    headerName: "Дата",
    field: "createdAt",
    valueFormatter: (p) => (p.value ? p.value.slice(0, 10) : ""),
  },
  { headerName: "Название", field: "title" },
  { headerName: "Статус", field: "status" },
];

export default recentTaskColumns;
