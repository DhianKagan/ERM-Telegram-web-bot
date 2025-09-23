// Конфигурация колонок задач для React Table
// Модули: React, @tanstack/react-table, EmployeeLink
import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { Task } from "shared";
import EmployeeLink from "../components/EmployeeLink";

// Оформление бейджей статусов и приоритетов на дизайн-токенах
const badgeBaseClass =
  "inline-flex max-w-full items-center justify-center whitespace-nowrap rounded-full px-2 py-0.5 text-center text-[0.7rem] font-semibold uppercase tracking-wide shadow-xs";

const buildBadgeClass = (
  tones: string,
  textClass = "text-primary dark:text-primary",
) => `${badgeBaseClass} transition-colors ${textClass} ${tones}`;

const defaultBadgeClass = buildBadgeClass(
  "bg-accent/60 ring-1 ring-primary/30 dark:bg-accent/45 dark:ring-primary/30",
);

const infoBadgeClass = buildBadgeClass(
  "bg-slate-500/20 ring-1 ring-slate-500/35 dark:bg-slate-400/25 dark:ring-slate-300/40",
  "text-slate-900 dark:text-slate-100 normal-case font-medium",
);

const numberBadgeClass = `${infoBadgeClass} px-2.5 py-1 text-xs font-semibold tracking-wide sm:text-sm`;

const assigneeBadgeClass = buildBadgeClass(
  "bg-indigo-500/20 ring-1 ring-indigo-500/40 dark:bg-indigo-400/25 dark:ring-indigo-300/45",
  "text-indigo-900 dark:text-indigo-100 normal-case font-medium whitespace-normal break-words text-left items-start justify-start",
);

const focusableBadgeClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const rectangularBadgeBaseClass =
  "block w-full min-w-0 max-w-full break-words rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-left text-xs font-medium leading-snug text-slate-800 shadow-xs transition-colors hover:bg-slate-100 dark:border-slate-600/60 dark:bg-slate-800/60 dark:text-slate-100 dark:hover:bg-slate-700/60";

const titleBadgeClass = `${rectangularBadgeBaseClass} font-semibold text-[0.85rem] sm:text-[0.95rem]`;

const locationBadgeClass = `${rectangularBadgeBaseClass} text-[0.8rem] sm:text-[0.85rem]`;

const statusBadgeClassMap: Record<Task["status"], string> = {
  Новая: buildBadgeClass(
    "bg-sky-500/20 ring-1 ring-sky-500/45 dark:bg-sky-400/25 dark:ring-sky-300/45",
    "text-sky-900 dark:text-sky-100",
  ),
  "В работе": buildBadgeClass(
    "bg-amber-500/25 ring-1 ring-amber-500/45 dark:bg-amber-400/25 dark:ring-amber-300/45",
    "text-amber-900 dark:text-amber-100",
  ),
  Выполнена: buildBadgeClass(
    "bg-emerald-500/20 ring-1 ring-emerald-500/40 dark:bg-emerald-400/25 dark:ring-emerald-300/45",
    "text-emerald-900 dark:text-emerald-100",
  ),
  Отменена: buildBadgeClass(
    "bg-rose-500/20 ring-1 ring-rose-500/40 dark:bg-rose-400/25 dark:ring-rose-300/45",
    "text-rose-900 dark:text-rose-100",
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

const priorityBadgeClassMap: Record<string, string> = {
  срочно: buildBadgeClass(
    "bg-rose-500/20 ring-1 ring-rose-500/40 dark:bg-rose-400/25 dark:ring-rose-300/45",
    "text-rose-900 dark:text-rose-100",
  ),
  'в течение дня': buildBadgeClass(
    "bg-sky-500/20 ring-1 ring-sky-500/40 dark:bg-sky-400/25 dark:ring-sky-300/45",
    "text-sky-900 dark:text-sky-100",
  ),
  'до выполнения': buildBadgeClass(
    "bg-slate-500/25 ring-1 ring-slate-500/45 dark:bg-slate-400/25 dark:ring-slate-300/45",
    "text-slate-900 dark:text-slate-100 normal-case",
  ),
};

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
  if (hasOwn(priorityBadgeClassMap, normalized)) {
    return priorityBadgeClassMap[normalized];
  }
  if (/сроч|urgent/.test(normalized)) {
    return urgentPriorityBadgeClass;
  }
  if (/высок|повыш|high/.test(normalized)) {
    return highPriorityBadgeClass;
  }
  if (/низк|бесср|без\s+срок|до\s+выполн|low|minor/.test(normalized)) {
    return lowPriorityBadgeClass;
  }
  if (/обыч|дня|сутк|norm|stand/.test(normalized)) {
    return normalPriorityBadgeClass;
  }
  return defaultBadgeClass;
};

const normalizePriorityLabel = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (/^бессроч/i.test(trimmed)) {
    return "До выполнения";
  }
  return trimmed;
};

const typeBadgeClassMap: Record<string, string> = {
  доставить: buildBadgeClass(
    "bg-sky-500/20 ring-1 ring-sky-500/40 dark:bg-sky-400/25 dark:ring-sky-300/45",
    "text-sky-900 dark:text-sky-100",
  ),
  купить: buildBadgeClass(
    "bg-violet-500/20 ring-1 ring-violet-500/40 dark:bg-violet-400/25 dark:ring-violet-300/45",
    "text-violet-900 dark:text-violet-100",
  ),
  выполнить: buildBadgeClass(
    "bg-emerald-500/20 ring-1 ring-emerald-500/40 dark:bg-emerald-400/25 dark:ring-emerald-300/45",
    "text-emerald-900 dark:text-emerald-100",
  ),
  построить: buildBadgeClass(
    "bg-amber-500/25 ring-1 ring-amber-500/45 dark:bg-amber-400/25 dark:ring-amber-300/45",
    "text-amber-900 dark:text-amber-100",
  ),
  починить: buildBadgeClass(
    "bg-orange-500/20 ring-1 ring-orange-500/40 dark:bg-orange-400/25 dark:ring-orange-300/45",
    "text-orange-900 dark:text-orange-100",
  ),
};

const getTypeBadgeClass = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return defaultBadgeClass;
  }
  if (hasOwn(typeBadgeClassMap, normalized)) {
    return typeBadgeClassMap[normalized];
  }
  if (/стро|монтаж/.test(normalized)) {
    return typeBadgeClassMap['построить'];
  }
  if (/ремонт|чин/.test(normalized)) {
    return typeBadgeClassMap['починить'];
  }
  if (/закуп|покуп|приобр/.test(normalized)) {
    return typeBadgeClassMap['купить'];
  }
  if (/достав|курьер/.test(normalized)) {
    return typeBadgeClassMap['доставить'];
  }
  if (/исполн|выполн/.test(normalized)) {
    return typeBadgeClassMap['выполнить'];
  }
  return defaultBadgeClass;
};

const parseDistance = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const normalized = Number(trimmed.replace(/\s+/g, "").replace(/,/g, "."));
    return Number.isFinite(normalized) ? normalized : null;
  }
  return null;
};

const formatDistanceLabel = (value: unknown) => {
  const numeric = parseDistance(value);
  if (numeric !== null) {
    return numeric.toLocaleString("ru-RU", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number") {
    return value.toString();
  }
  return "";
};

const shortDistanceBadgeClass = buildBadgeClass(
  "bg-emerald-500/20 ring-1 ring-emerald-500/40 dark:bg-emerald-400/25 dark:ring-emerald-300/45",
  "text-emerald-900 dark:text-emerald-100",
);

const mediumDistanceBadgeClass = buildBadgeClass(
  "bg-sky-500/20 ring-1 ring-sky-500/40 dark:bg-sky-400/25 dark:ring-sky-300/45",
  "text-sky-900 dark:text-sky-100",
);

const longDistanceBadgeClass = buildBadgeClass(
  "bg-amber-500/25 ring-1 ring-amber-500/45 dark:bg-amber-400/25 dark:ring-amber-300/45",
  "text-amber-900 dark:text-amber-100",
);

const extraLongDistanceBadgeClass = buildBadgeClass(
  "bg-rose-500/20 ring-1 ring-rose-500/40 dark:bg-rose-400/25 dark:ring-rose-300/45",
  "text-rose-900 dark:text-rose-100",
);

const getDistanceBadgeClass = (value: unknown) => {
  const numeric = parseDistance(value);
  if (numeric === null) {
    return defaultBadgeClass;
  }
  if (numeric < 5) {
    return shortDistanceBadgeClass;
  }
  if (numeric < 25) {
    return mediumDistanceBadgeClass;
  }
  if (numeric < 100) {
    return longDistanceBadgeClass;
  }
  return extraLongDistanceBadgeClass;
};

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
    <span
      className={`${infoBadgeClass} items-start justify-center font-mono`}
      title={formatted.full}
    >
      <time
        dateTime={value}
        className="flex flex-col tabular-nums leading-tight"
      >
        <span className="leading-tight">{formatted.date}</span>
        {formatted.time ? (
          <span className="text-muted-foreground text-[0.85em] leading-tight">
            {formatted.time}
          </span>
        ) : null}
      </time>
    </span>
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
          <span className={`${numberBadgeClass} font-mono`} title={value}>
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
        const compact = compactText(v, 72);
        return (
          <span title={v} className={titleBadgeClass}>
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
        width: "clamp(8.5rem, 15vw, 12.5rem)",
        minWidth: "8.5rem",
        maxWidth: "12.5rem",
      },
      cell: (p) => {
        const value = p.getValue<string>() || "";
        if (!value.trim()) {
          return "";
        }
        const display = normalizePriorityLabel(value);
        return (
          <span className={getPriorityBadgeClass(value)} title={display}>
            {display}
          </span>
        );
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
      cell: (p) => {
        const value = p.getValue<string>() || "";
        const trimmed = value.trim();
        if (!trimmed) {
          return "";
        }
        return (
          <span className={getTypeBadgeClass(trimmed)} title={trimmed}>
            {trimmed}
          </span>
        );
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
        const compact = compactText(name, 48);
        const link = row.original.start_location_link;
        return link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={`${locationBadgeClass} ${focusableBadgeClass} no-underline`}
            title={name}
          >
            {compact}
          </a>
        ) : (
          <span title={name} className={locationBadgeClass}>
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
        const compact = compactText(name, 48);
        const link = row.original.end_location_link;
        return link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={`${locationBadgeClass} ${focusableBadgeClass} no-underline`}
            title={name}
          >
            {compact}
          </a>
        ) : (
          <span title={name} className={locationBadgeClass}>
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
      cell: (p) => {
        const raw = p.getValue<number | string | null>();
        if (raw === null || raw === undefined || (typeof raw === "string" && !raw.trim())) {
          return "";
        }
        const display = formatDistanceLabel(raw);
        if (!display) {
          return "";
        }
        return (
          <span className={getDistanceBadgeClass(raw)} title={`${display} км`}>
            {display}
          </span>
        );
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
        const tooltip = labels.map((item) => item.label).join(", ");
        return (
          <div
            className="flex w-full flex-wrap items-start gap-1 leading-tight"
            title={tooltip}
          >
            {labels.map(({ id, label }) => (
              <EmployeeLink
                key={id}
                employeeId={id}
                stopPropagation
                className={`${assigneeBadgeClass} ${focusableBadgeClass} no-underline`}
              >
                {compactText(label, 18)}
              </EmployeeLink>
            ))}
          </div>
        );
      },
    },
  ];
  return cols;
}
