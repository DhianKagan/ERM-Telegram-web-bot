// Конфигурация колонок логов для AG Grid
// Модули: ag-grid
import type { ColDef } from "ag-grid-community";

const logColumns: ColDef[] = [
  { headerName: "Уровень", field: "level" },
  { headerName: "Время", field: "time" },
  { headerName: "Метод", field: "method" },
  { headerName: "Статус", field: "status" },
  { headerName: "Endpoint", field: "endpoint" },
  { headerName: "Сообщение", field: "message", flex: 1 },
];

export default logColumns;
