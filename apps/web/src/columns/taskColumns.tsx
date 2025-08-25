// Конфигурация колонок задач для React Table
// Модули: @tanstack/react-table, userLink
import type { ColumnDef } from "@tanstack/react-table";
import userLink from "../utils/userLink";
import type { Task } from "shared";

export type TaskRow = Task & Record<string, any>;

export default function taskColumns(
  selectable: boolean,
  users: Record<number, any>,
): ColumnDef<TaskRow, any>[] {
  const cols: ColumnDef<TaskRow, any>[] = [
    {
      header: "Номер",
      accessorKey: "task_number",
    },
    {
      header: "Дата создания",
      accessorKey: "createdAt",
      cell: (p) =>
        p.getValue<string>() ? p.getValue<string>().slice(0, 10) : "",
    },
    { header: "Название", accessorKey: "title" },
    { header: "Статус", accessorKey: "status" },
    { header: "Приоритет", accessorKey: "priority" },
    { header: "Начало", accessorKey: "start_date" },
    { header: "Срок", accessorKey: "due_date" },
    { header: "Тип", accessorKey: "task_type" },
    {
      header: "Старт",
      accessorKey: "startCoordinates",
      cell: (p) => {
        const v = p.getValue<any>();
        return v ? `${v.lat}, ${v.lng}` : "";
      },
    },
    {
      header: "Финиш",
      accessorKey: "finishCoordinates",
      cell: (p) => {
        const v = p.getValue<any>();
        return v ? `${v.lat}, ${v.lng}` : "";
      },
    },
    { header: "Км", accessorKey: "route_distance_km" },
    {
      header: "Исполнители",
      accessorKey: "assignees",
      cell: ({ row }) => {
        const ids: number[] =
          row.original.assignees ||
          (row.original.assigned_user_id
            ? [row.original.assigned_user_id]
            : []);
        return (
          <>
            {ids.map((id) => (
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
            ))}
          </>
        );
      },
    },
  ];
  if (selectable) {
    cols.unshift({
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={(e) => row.toggleSelected(e.target.checked)}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    });
  }
  return cols;
}
