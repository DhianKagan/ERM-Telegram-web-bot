// Конфигурация колонок задач для React Table
// Модули: React, @tanstack/react-table, react-router-dom
import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import type { Task } from "shared";

// Оформление бейджей статусов и приоритетов на дизайн-токенах
const badgeBaseClass =
  "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide shadow-xs";

const buildBadgeClass = (tones: string) =>
  `${badgeBaseClass} text-primary transition-colors dark:text-primary ${tones}`;

const defaultBadgeClass = buildBadgeClass(
  "bg-accent/60 ring-1 ring-primary/30 dark:bg-accent/45 dark:ring-primary/30",
);

const statusBadgeClassMap: Record<Task["status"], string> = {
  Новая: buildBadgeClass(
    "bg-accent/70 ring-1 ring-primary/30 dark:bg-accent/50 dark:ring-primary/30",
  ),
  "В работе": buildBadgeClass(
    "bg-accent/80 ring-1 ring-primary/40 dark:bg-accent/60 dark:ring-primary/40",
  ),
  Выполнена: buildBadgeClass(
    "bg-accent/50 ring-1 ring-primary/20 dark:bg-accent/40 dark:ring-primary/20",
  ),
  Отменена: buildBadgeClass(
    "bg-accent/40 ring-1 ring-destructive/40 dark:bg-accent/30 dark:ring-destructive/40",
  ),
};

const urgentPriorityBadgeClass = buildBadgeClass(
  "bg-accent/80 ring-1 ring-destructive/40 dark:bg-accent/60 dark:ring-destructive/40",
);

const highPriorityBadgeClass = buildBadgeClass(
  "bg-accent/75 ring-1 ring-primary/40 dark:bg-accent/55 dark:ring-primary/40",
);

const normalPriorityBadgeClass = buildBadgeClass(
  "bg-accent/65 ring-1 ring-primary/30 dark:bg-accent/45 dark:ring-primary/30",
);

const lowPriorityBadgeClass = buildBadgeClass(
  "bg-accent/50 ring-1 ring-primary/20 dark:bg-accent/35 dark:ring-primary/20",
);

const hasOwn = <T extends Record<string, unknown>>(obj: T, key: string): key is keyof T =>
  Object.prototype.hasOwnProperty.call(obj, key);

const getStatusBadgeClass = (value: string) => {
  if (hasOwn(statusBadgeClassMap, value)) {
    return statusBadgeClassMap[value];
  }
  return defaultBadgeClass;
};

const getPriorityBadgeClass = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return defaultBadgeClass;
  }
  if (/сроч|urgent/.test(normalized)) {
    return urgentPriorityBadgeClass;
  }
  if (/высок|повыш|high/.test(normalized)) {
    return highPriorityBadgeClass;
  }
  if (/низк|бесср|без\s+срок|low|minor/.test(normalized)) {
    return lowPriorityBadgeClass;
  }
  if (/обыч|дня|сутк|norm|stand/.test(normalized)) {
    return normalPriorityBadgeClass;
  }
  return defaultBadgeClass;
};

const focusableLinkClass =
  "text-primary underline decoration-2 underline-offset-2 transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const fullDateTimeFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const datePartFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timePartFmt = new Intl.DateTimeFormat("ru-RU", {
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
  const datePart = datePartFmt.format(date);
  const timePart = timePartFmt.format(date);
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
      <span className="leading-tight">{formatted.date}</span>
      {formatted.time ? (
        <span className="text-muted-foreground text-[0.85em] leading-tight">
          {formatted.time}
        </span>
      ) : null}
    </time>
  );
};

// Делает текст компактнее, добавляя многоточие по необходимости
const compactText = (value: string, maxLength: number) => {
  const trimmed = value.trim();
  if (!trimmed || maxLength < 2 || trimmed.length <= maxLength) {
    return trimmed;
  }
  const shortened = trimmed.slice(0, maxLength - 1).trimEnd();
  return `${shortened}…`;
};

export type TaskRow = Task & Record<string, any>;

export default function taskColumns(
  users: Record<number, any>,
): ColumnDef<TaskRow, any>[] {
  const cols: ColumnDef<TaskRow, any>[] = [
    {
      header: "Номер",
      accessorKey: "task_number",
      meta: {
        width: "clamp(3.25rem, 5vw, 4.25rem)",
        minWidth: "3.25rem",
        maxWidth: "4.25rem",
        cellClassName:
          "text-center font-mono tabular-nums sm:text-left sm:pl-1.5",
        headerClassName: "text-center sm:text-left",
      },
      cell: (p) => {
        const value = p.getValue<string>() || "";
        const numericMatch = value.match(/\d+/);
        const shortValue = numericMatch ? numericMatch[0] : value;
        return (
          <span
            className="block whitespace-nowrap"
            title={value}
          >
            {shortValue}
          </span>
        );
      },
    },
    {
      header: "Дата создания",
      accessorKey: "createdAt",
      meta: {
        width: "clamp(6.75rem, 11vw, 8.75rem)",
        minWidth: "6.5rem",
        maxWidth: "9rem",
        cellClassName: "text-xs sm:text-sm",
      },
      cell: (p) => renderDateCell(p.getValue<string>()),
    },
    {
      header: "Название",
      accessorKey: "title",
      meta: {
        width: "clamp(9rem, 24vw, 18rem)",
        minWidth: "7rem",
        maxWidth: "18rem",
      },
      cell: (p) => {
        const v = p.getValue<string>() || "";
        const compact = compactText(v, 48);
        return (
          <span title={v} className="block leading-tight">
            {compact}
          </span>
        );
      },
    },
    {
      header: "Статус",
      accessorKey: "status",
      meta: {
        width: "clamp(4.5rem, 8vw, 6.5rem)",
        minWidth: "4.5rem",
        maxWidth: "6.5rem",
      },
      cell: (p) => {
        const value = p.getValue<string>() || "";
        if (!value) {
          return "";
        }
        return <span className={getStatusBadgeClass(value)}>{value}</span>;
      },
    },
    {
      header: "Приоритет",
      accessorKey: "priority",
      meta: {
        width: "clamp(4.5rem, 7vw, 6.5rem)",
        minWidth: "4.5rem",
        maxWidth: "6.5rem",
      },
      cell: (p) => {
        const value = p.getValue<string>() || "";
        if (!value) {
          return "";
        }
        return <span className={getPriorityBadgeClass(value)}>{value}</span>;
      },
    },
    {
      header: "Начало",
      accessorKey: "start_date",
      meta: {
        width: "clamp(6.75rem, 11vw, 8.75rem)",
        minWidth: "6.5rem",
        maxWidth: "9rem",
        cellClassName: "text-xs sm:text-sm",
      },
      cell: (p) => renderDateCell(p.getValue<string>()),
    },
    {
      header: "Срок",
      accessorKey: "due_date",
      meta: {
        width: "clamp(6.75rem, 11vw, 8.75rem)",
        minWidth: "6.5rem",
        maxWidth: "9rem",
        cellClassName: "text-xs sm:text-sm",
      },
      cell: (p) => renderDateCell(p.getValue<string>()),
    },
    {
      header: "Тип",
      accessorKey: "task_type",
      meta: {
        width: "clamp(4.5rem, 8vw, 6.5rem)",
        minWidth: "4.5rem",
        maxWidth: "6.5rem",
      },
    },
    {
      header: "Старт",
      accessorKey: "start_location",
      meta: {
        width: "clamp(6.5rem, 18vw, 12rem)",
        minWidth: "6rem",
        maxWidth: "12rem",
      },
      cell: ({ row }) => {
        const name = row.original.start_location || "";
        const compact = compactText(name, 36);
        const link = row.original.start_location_link;
        return link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={focusableLinkClass}
            title={name}
          >
            {compact}
          </a>
        ) : (
          <span title={name} className="block leading-tight">
            {compact}
          </span>
        );
      },
    },
    {
      header: "Финиш",
      accessorKey: "end_location",
      meta: {
        width: "clamp(6.5rem, 18vw, 12rem)",
        minWidth: "6rem",
        maxWidth: "12rem",
      },
      cell: ({ row }) => {
        const name = row.original.end_location || "";
        const compact = compactText(name, 36);
        const link = row.original.end_location_link;
        return link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={focusableLinkClass}
            title={name}
          >
            {compact}
          </a>
        ) : (
          <span title={name} className="block leading-tight">
            {compact}
          </span>
        );
      },
    },
    {
      header: "Км",
      accessorKey: "route_distance_km",
      meta: {
        width: "clamp(3.25rem, 6vw, 4.75rem)",
        minWidth: "3rem",
        maxWidth: "4.75rem",
        cellClassName: "text-center sm:text-left",
        headerClassName: "text-center sm:text-left",
      },
    },
    {
      header: "Исполнители",
      accessorKey: "assignees",
      meta: {
        width: "clamp(7rem, 20vw, 13rem)",
        minWidth: "6rem",
        maxWidth: "13rem",
      },
      cell: ({ row }) => {
        const ids: number[] =
          row.original.assignees ||
          (row.original.assigned_user_id
            ? [row.original.assigned_user_id]
            : []);
        if (!ids.length) {
          return <span className="text-muted-foreground">—</span>;
        }
        const labels = ids.map((id) => ({
          id,
          label:
            users[id]?.name ||
            users[id]?.telegram_username ||
            users[id]?.username ||
            String(id),
        }));
        const visible = labels.slice(0, 2);
        const hiddenCount = labels.length - visible.length;
        const tooltip = labels.map((item) => item.label).join(", ");
        return (
          <div
            className="flex flex-wrap items-center gap-x-1 gap-y-0.5 leading-tight"
            title={tooltip}
          >
            {visible.map(({ id, label }) => (
              <Link
                key={id}
                to={`/employees/${id}`}
                className={focusableLinkClass}
                onClick={(event) => event.stopPropagation()}
              >
                {compactText(label, 18)}
              </Link>
            ))}
            {hiddenCount > 0 ? (
              <span className="text-muted-foreground">+{hiddenCount}</span>
            ) : null}
          </div>
        );
      },
    },
  ];
  return cols;
}
