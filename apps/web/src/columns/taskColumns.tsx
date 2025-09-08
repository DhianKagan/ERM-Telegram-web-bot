// Конфигурация колонок задач для React Table
// Модули: React, @tanstack/react-table, userLink
import React from "react";
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
      cell: (p) => {
        const v = p.getValue<string>();
        return v
          ? new Date(v).toLocaleString("ru-RU", {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "";
      },
    },
    {
      header: "Название",
      accessorKey: "title",
      cell: (p) => {
        const v = p.getValue<string>() || "";
        return <span title={v}>{v}</span>;
      },
    },
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
        const text = v ? `${v.lat}, ${v.lng}` : "";
        return <span title={text}>{text}</span>;
      },
    },
    {
      header: "Финиш",
      accessorKey: "finishCoordinates",
      cell: (p) => {
        const v = p.getValue<any>();
        const text = v ? `${v.lat}, ${v.lng}` : "";
        return <span title={text}>{text}</span>;
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
