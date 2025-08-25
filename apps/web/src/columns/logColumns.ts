// Конфигурация колонок логов для React Table
// Модули: @tanstack/react-table
import type { ColumnDef } from "@tanstack/react-table";

export interface LogRow {
  level: string;
  time: string;
  method: string;
  status: number;
  endpoint: string;
  message: string;
}

const logColumns: ColumnDef<LogRow>[] = [
  { header: "Уровень", accessorKey: "level" },
  { header: "Время", accessorKey: "time" },
  { header: "Метод", accessorKey: "method" },
  { header: "Статус", accessorKey: "status" },
  { header: "Endpoint", accessorKey: "endpoint" },
  { header: "Сообщение", accessorKey: "message" },
];

export default logColumns;
