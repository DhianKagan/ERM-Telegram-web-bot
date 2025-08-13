// Колонки для таблицы последних задач
// Модули: ag-grid
import type { ColDef } from "ag-grid-community";

const recentTaskColumns: ColDef[] = [
  {
    headerName: "Название",
    field: "title",
    valueGetter: (p) => {
      const name = p.data.title?.replace(/^ERM_\d+\s*/, "") || "";
      const date = p.data.createdAt?.slice(0, 10) || "";
      return `${p.data.request_id || ""} ${date} ${name}`;
    },
  },
  { headerName: "Статус", field: "status" },
];

export default recentTaskColumns;
