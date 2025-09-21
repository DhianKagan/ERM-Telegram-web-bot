// Конфигурация колонок задач для React Table
// Модули: React, @tanstack/react-table, react-router-dom
import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import type { Task } from "shared";

// Цвета статусов задач для соответствия WCAG контрасту ≥4.5:1
const statusColorMap: Record<Task["status"], string> = {
  Новая: "text-gray-600",
  "В работе": "text-blue-600",
  Выполнена: "text-green-600",
};

const fullDateTimeFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const compactDateTimeFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const formatDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const full = fullDateTimeFmt.format(date).replace(", ", " ");
  const compact = compactDateTimeFmt.format(date).replace(", ", " ");
  const [datePart, timePart] = compact.split(" ");
  return {
    full,
    date: datePart || full,
    time: timePart,
  };
};

const renderDateCell = (value?: string) => {
  const formatted = formatDate(value);
  if (!formatted) return "";
  return (
    <time
      dateTime={value}
      title={formatted.full}
      className="inline-flex flex-col font-mono tabular-nums leading-tight"
    >
      <span>{formatted.date}</span>
      {formatted.time ? (
        <span className="text-muted-foreground">{formatted.time}</span>
      ) : null}
    </time>
  );
};

export type TaskRow = Task & Record<string, any>;

export default function taskColumns(
  users: Record<number, any>,
): ColumnDef<TaskRow, any>[] {
  const cols: ColumnDef<TaskRow, any>[] = [
    {
      header: "Номер",
      accessorKey: "task_number",
      meta: { minWidth: "2.75rem", maxWidth: "3.5rem" },
      cell: (p) => {
        const value = p.getValue<string>() || "";
        return (
          <span className="font-mono tabular-nums whitespace-nowrap">
            {value}
          </span>
        );
      },
    },
    {
      header: "Дата создания",
      accessorKey: "createdAt",
      meta: {
        minWidth: "6.25rem",
        maxWidth: "7.5rem",
        cellClassName: "flex flex-col gap-0.5 text-xs sm:text-sm",
      },
      cell: (p) => renderDateCell(p.getValue<string>()),
    },
    {
      header: "Название",
      accessorKey: "title",
      meta: { minWidth: "8rem", maxWidth: "16rem" },
      cell: (p) => {
        const v = p.getValue<string>() || "";
        return <span title={v}>{v}</span>;
      },
    },
    {
      header: "Статус",
      accessorKey: "status",
      meta: { minWidth: "4.5rem", maxWidth: "6.5rem" },
      cell: (p) => {
        const value = p.getValue<string>() || "";
        return <span className={statusColorMap[value] || ""}>{value}</span>;
      },
    },
    {
      header: "Приоритет",
      accessorKey: "priority",
      meta: { minWidth: "4.5rem", maxWidth: "6.5rem" },
    },
    {
      header: "Начало",
      accessorKey: "start_date",
      meta: {
        minWidth: "6.25rem",
        maxWidth: "7.5rem",
        cellClassName: "flex flex-col gap-0.5 text-xs sm:text-sm",
      },
      cell: (p) => renderDateCell(p.getValue<string>()),
    },
    {
      header: "Срок",
      accessorKey: "due_date",
      meta: {
        minWidth: "6.25rem",
        maxWidth: "7.5rem",
        cellClassName: "flex flex-col gap-0.5 text-xs sm:text-sm",
      },
      cell: (p) => renderDateCell(p.getValue<string>()),
    },
    {
      header: "Тип",
      accessorKey: "task_type",
      meta: { minWidth: "4.5rem", maxWidth: "6.5rem" },
    },
    {
      header: "Старт",
      accessorKey: "start_location",
      meta: { minWidth: "7rem", maxWidth: "10rem" },
      cell: ({ row }) => {
        const name = row.original.start_location || "";
        const link = row.original.start_location_link;
        return link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
            title={name}
          >
            {name}
          </a>
        ) : (
          <span title={name}>{name}</span>
        );
      },
    },
    {
      header: "Финиш",
      accessorKey: "end_location",
      meta: { minWidth: "7rem", maxWidth: "10rem" },
      cell: ({ row }) => {
        const name = row.original.end_location || "";
        const link = row.original.end_location_link;
        return link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
            title={name}
          >
            {name}
          </a>
        ) : (
          <span title={name}>{name}</span>
        );
      },
    },
    {
      header: "Км",
      accessorKey: "route_distance_km",
      meta: { minWidth: "3rem", maxWidth: "4.5rem" },
    },
    {
      header: "Исполнители",
      accessorKey: "assignees",
      meta: { minWidth: "7rem", maxWidth: "12rem" },
      cell: ({ row }) => {
        const ids: number[] =
          row.original.assignees ||
          (row.original.assigned_user_id
            ? [row.original.assigned_user_id]
            : []);
        return (
          <div className="flex flex-wrap gap-1">
            {ids.map((id) => {
              const label =
                users[id]?.name ||
                users[id]?.telegram_username ||
                users[id]?.username ||
                String(id);
              return (
                <Link
                  key={id}
                  to={`/employees/${id}`}
                  className="text-blue-600 underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        );
      },
    },
  ];
  return cols;
}
