// Конфигурация колонок архива задач
// Основные модули: React, @tanstack/react-table
import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ArchiveTask } from "../types/archive";

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateTimeFormatter.format(date);
}

export default function archiveColumns({
  enableSelection,
  selectedIds,
  onToggleRow,
  onToggleAll,
  visibleCount,
}: {
  enableSelection: boolean;
  selectedIds: Set<string>;
  onToggleRow: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  visibleCount: number;
}): ColumnDef<ArchiveTask>[] {
  const columns: ColumnDef<ArchiveTask>[] = [];
  if (enableSelection) {
    columns.push({
      id: "select",
      header: () => {
        const allSelected =
          visibleCount > 0 && selectedIds.size >= visibleCount;
        const indeterminate =
          selectedIds.size > 0 && selectedIds.size < visibleCount;
        return (
          <input
            type="checkbox"
            aria-label="Выбрать все"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = indeterminate && !allSelected;
            }}
            onChange={(event) => onToggleAll(event.target.checked)}
          />
        );
      },
      cell: ({ row }) => {
        const id = row.original.id;
        if (!id) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <input
            type="checkbox"
            aria-label={`Выбрать задачу ${row.original.task_number || id}`}
            checked={selectedIds.has(id)}
            onChange={(event) => onToggleRow(id, event.target.checked)}
          />
        );
      },
      meta: { width: "3rem", minWidth: "3rem", maxWidth: "3rem" },
    });
  }
  columns.push(
    {
      header: "Номер",
      accessorKey: "task_number",
      meta: {
        width: "8rem",
        minWidth: "6rem",
        maxWidth: "8rem",
        cellClassName: "font-mono text-xs sm:text-sm",
      },
      cell: ({ row }) => row.original.task_number || row.original.id || "—",
    },
    {
      header: "Название",
      accessorKey: "title",
      meta: {
        width: "16rem",
        minWidth: "10rem",
        maxWidth: "22rem",
        cellClassName: "whitespace-normal",
      },
      cell: ({ row }) => {
        const title = row.original.title || "—";
        return <span className="line-clamp-2 break-words text-sm">{title}</span>;
      },
    },
    {
      header: "Статус",
      accessorKey: "status",
      meta: {
        width: "8rem",
        minWidth: "6rem",
        maxWidth: "10rem",
      },
      cell: ({ row }) => row.original.status || "—",
    },
    {
      header: "Удалена",
      accessorKey: "archived_at",
      meta: {
        width: "10rem",
        minWidth: "8rem",
        maxWidth: "12rem",
      },
      cell: ({ row }) => formatDate(row.original.archived_at),
    },
  );
  return columns;
}
