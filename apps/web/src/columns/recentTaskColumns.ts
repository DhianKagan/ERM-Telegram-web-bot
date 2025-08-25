// Колонки для таблицы последних задач на React Table
// Модули: @tanstack/react-table
import type { ColumnDef } from "@tanstack/react-table";
import type { Task } from "shared";

type RecentTask = Task & {
  status: string;
  task_number: string;
  createdAt: string;
};

const recentTaskColumns: ColumnDef<RecentTask>[] = [
  { header: "Номер", accessorKey: "task_number" },
  {
    header: "Дата",
    accessorKey: "createdAt",
    cell: (p) =>
      p.getValue<string>() ? p.getValue<string>().slice(0, 10) : "",
  },
  { header: "Название", accessorKey: "title" },
  { header: "Статус", accessorKey: "status" },
];

export default recentTaskColumns;
