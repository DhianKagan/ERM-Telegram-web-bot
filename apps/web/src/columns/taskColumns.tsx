// Конфигурация колонок задач для React Table
// Модули: React, @tanstack/react-table, heroicons, EmployeeLink
import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { Task } from "shared";
import {
  ClockIcon,
  QuestionMarkCircleIcon,
  StopCircleIcon,
} from "@heroicons/react/20/solid";
import EmployeeLink from "../components/EmployeeLink";
import {
  formatDurationShort,
  getDeadlineState,
} from "./taskDeadline";

// Оформление бейджей статусов и приоритетов на дизайн-токенах
const badgeBaseClass =
  "inline-flex min-w-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-center text-[0.68rem] font-semibold uppercase tracking-wide shadow-xs";

const buildBadgeClass = (
  tones: string,
  textClass = "text-primary dark:text-primary",
) => `${badgeBaseClass} transition-colors ${textClass} ${tones}`;

const focusableBadgeClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const pillBadgeBaseClass =
  "inline-flex max-w-full min-w-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-left text-[0.72rem] font-semibold leading-tight tracking-normal shadow-xs sm:text-[0.78rem]";

const dateBadgeClass =
  `${pillBadgeBaseClass} font-mono normal-case text-slate-900 ring-1 ring-slate-500/30 bg-slate-500/10 dark:bg-slate-500/20 dark:text-slate-100 dark:ring-slate-400/30`;

const dateBadgeTimeClass =
  "text-[0.65rem] font-semibold text-slate-500 dark:text-slate-200";

const numberBadgeClass =
  `${pillBadgeBaseClass} justify-center font-mono uppercase tracking-[0.18em] text-[0.68rem] text-slate-900 ring-1 ring-slate-500/30 bg-slate-500/10 dark:bg-slate-500/20 dark:text-slate-100 dark:ring-slate-400/30`;

const titleBadgeClass =
  `${pillBadgeBaseClass} justify-start normal-case text-slate-900 ring-1 ring-indigo-500/35 bg-indigo-500/12 dark:bg-indigo-400/15 dark:text-slate-100 dark:ring-indigo-400/30`;

const creatorBadgeClass =
  `${pillBadgeBaseClass} max-w-full w-full justify-start normal-case text-indigo-900 ring-1 ring-indigo-500/35 bg-indigo-500/12 dark:bg-indigo-400/15 dark:text-slate-100 dark:ring-indigo-400/30`;

const fallbackBadgeClass = buildBadgeClass(
  "bg-muted/60 ring-1 ring-muted-foreground/30 dark:bg-slate-700/60 dark:ring-slate-500/35",
  "text-slate-900 dark:text-slate-100",
);

const locationBadgeClass =
  `${pillBadgeBaseClass} normal-case text-emerald-900 ring-1 ring-emerald-500/30 bg-emerald-500/15 dark:bg-emerald-400/20 dark:text-emerald-100 dark:ring-emerald-300/30`;

const locationLinkBadgeClass =
  `${locationBadgeClass} ${focusableBadgeClass} no-underline underline-offset-4 hover:underline`;

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

const hasOwn = <T extends Record<PropertyKey, unknown>>(obj: T, key: PropertyKey): key is keyof T =>
  Object.prototype.hasOwnProperty.call(obj, key);

const getStatusBadgeClass = (value: string) => {
  if (hasOwn(statusBadgeClassMap, value)) {
    return statusBadgeClassMap[value];
  }
  return null;
};

const getPriorityBadgeClass = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
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
  return null;
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
    return null;
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
  return null;
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
    return null;
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
    <span className={dateBadgeClass} title={formatted.full}>
      <time
        dateTime={value}
        className="flex w-full items-baseline gap-1 truncate tabular-nums"
      >
        <span className="truncate">{formatted.date}</span>
        {formatted.time ? (
          <span className={dateBadgeTimeClass}>{formatted.time}</span>
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
        width: "clamp(4.25rem, 8vw, 6.25rem)",
        minWidth: "4rem",
        maxWidth: "6.5rem",
        cellClassName:
          "whitespace-nowrap text-center font-mono tabular-nums sm:text-left sm:pl-1.5",
        headerClassName: "whitespace-nowrap text-center sm:text-left",
      },
      cell: (p) => {
        const value = p.getValue<string>() || "";
        const numericMatch = value.match(/\d+/);
        const shortValue = numericMatch ? numericMatch[0] : value;
        return (
          <span className={`${numberBadgeClass} justify-center`} title={value}>
            <span className="truncate">{shortValue}</span>
          </span>
        );
      },
    },
    {
      header: "Задачу создал",
      accessorKey: "createdAt",
      meta: {
        width: "clamp(9rem, 18vw, 14rem)",
        minWidth: "8.5rem",
        maxWidth: "16rem",
        cellClassName: "whitespace-nowrap",
      },
      cell: ({ row }) => {
        const rawCreator =
          (row.original.created_by as unknown) ??
          (row.original.createdBy as unknown) ??
          (row.original.creator as unknown);
        const creatorId =
          typeof rawCreator === "number"
            ? rawCreator
            : typeof rawCreator === "string" && rawCreator.trim()
            ? Number(rawCreator)
            : NaN;
        if (!Number.isFinite(creatorId)) {
          return <span className="text-muted-foreground">—</span>;
        }
        const id = creatorId as number;
        const user = users[id];
        const label =
          (user?.name as string | undefined) ||
          (user?.telegram_username as string | undefined) ||
          (user?.username as string | undefined) ||
          String(id);
        const title = label.trim() || String(id);
        return (
          <EmployeeLink
            employeeId={id}
            stopPropagation
            title={title}
            className={`${creatorBadgeClass} ${focusableBadgeClass} no-underline`}
          >
            <span className="truncate">{compactText(label, 32)}</span>
          </EmployeeLink>
        );
      },
    },
    {
      header: "Название",
      accessorKey: "title",
      meta: {
        width: "clamp(6rem, 16vw, 13rem)",
        minWidth: "5rem",
        maxWidth: "13rem",
        cellClassName: "whitespace-nowrap",
      },
      cell: (p) => {
        const v = p.getValue<string>() || "";
        const compact = compactText(v, 72);
        return (
          <span title={v} className={titleBadgeClass}>
            <span className="truncate">{compact}</span>
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
                className={`${creatorBadgeClass} ${focusableBadgeClass} no-underline`}
              >
                <span className="truncate">{compactText(label, 18)}</span>
              </EmployeeLink>
            ))}
          </div>
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
        cellClassName: "whitespace-nowrap",
      },
      cell: (p) => {
        const value = p.getValue<string>() || "";
        if (!value) {
          return "";
        }
        const badgeClass = getStatusBadgeClass(value);
        if (!badgeClass) {
          return <span className={fallbackBadgeClass}>{value}</span>;
        }
        return <span className={badgeClass}>{value}</span>;
      },
    },
    {
      header: "Приоритет",
      accessorKey: "priority",
      meta: {
        width: "clamp(8.5rem, 15vw, 12.5rem)",
        minWidth: "8.5rem",
        maxWidth: "12.5rem",
        cellClassName: "whitespace-nowrap",
      },
      cell: (p) => {
        const value = p.getValue<string>() || "";
        if (!value.trim()) {
          return "";
        }
        const display = normalizePriorityLabel(value);
        const badgeClass = getPriorityBadgeClass(value);
        const className = badgeClass || `${fallbackBadgeClass} normal-case`;
        return (
          <span className={className} title={display}>
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
        cellClassName: "whitespace-nowrap text-xs sm:text-sm",
      },
      cell: (p) => renderDateCell(p.getValue<string>()),
    },
    {
      header: "Выполнить до",
      accessorKey: "due_date",
      meta: {
        width: "clamp(7.75rem, 12.5vw, 10rem)",
        minWidth: "7.5rem",
        maxWidth: "10.5rem",
        cellClassName: "whitespace-nowrap text-xs sm:text-sm",
      },
      cell: (p) => {
        const dueValue = p.getValue<string>();
        const row = p.row.original;
        const formatted = formatDate(dueValue);
        const state = getDeadlineState(row.start_date, row.due_date);

        if (state.kind === "invalid") {
          return (
            <span
              className={`${dateBadgeClass} flex min-w-0 items-center gap-1`}
              title={
                state.reason === "missing"
                  ? "Срок не назначен"
                  : "Срок указан некорректно"
              }
            >
              <QuestionMarkCircleIcon
                className="size-4 flex-shrink-0 text-slate-400 dark:text-slate-500"
                aria-hidden
              />
              <span className="truncate">Нет данных</span>
            </span>
          );
        }

        const isOverdue = state.kind === "overdue";
        const iconClassName =
          state.kind === "countdown"
            ? state.level === "safe"
              ? "text-emerald-600 dark:text-emerald-400"
              : state.level === "warn"
                ? "text-amber-500 dark:text-amber-300"
                : "text-orange-500 dark:text-orange-300"
            : isOverdue
              ? "text-rose-600 dark:text-rose-400"
              : "text-slate-400 dark:text-slate-500";

        const remainingLabel =
          state.remainingMs !== null
            ? formatDurationShort(state.remainingMs)
            : null;

        const subtitle = (() => {
          if (state.remainingMs === null) {
            return null;
          }
          if (isOverdue) {
            return `Просрочено на ${remainingLabel}`;
          }
          if (state.kind === "pending") {
            return state.issue === "missing-start"
              ? "Нет даты начала"
              : "Диапазон дат некорректен";
          }
          return `Осталось ${remainingLabel}`;
        })();

        const percentLabel =
          state.kind === "countdown"
            ? `${Math.round(state.ratio * 100)}%`
            : null;

        const icon = isOverdue ? (
          <StopCircleIcon
            className={`size-4 flex-shrink-0 ${iconClassName}`}
            aria-hidden
          />
        ) : (
          <ClockIcon
            className={`size-4 flex-shrink-0 ${iconClassName}`}
            aria-hidden
          />
        );

        return (
          <span
            className={`${dateBadgeClass} flex min-w-0 flex-col gap-0.5`}
            title={
              formatted
                ? isOverdue
                  ? `Просрочено с ${formatted.full}`
                  : `Выполнить до ${formatted.full}`
                : undefined
            }
          >
            <span className="flex min-w-0 items-center gap-1">
              {icon}
              {formatted ? (
                <time
                  dateTime={dueValue}
                  className="flex min-w-0 items-baseline gap-1 truncate tabular-nums"
                >
                  <span className="truncate">{formatted.date}</span>
                  {formatted.time ? (
                    <span className={dateBadgeTimeClass}>{formatted.time}</span>
                  ) : null}
                </time>
              ) : (
                <span className="truncate">{row.due_date}</span>
              )}
              {percentLabel ? (
                <span className="ml-auto shrink-0 text-[0.62rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-200">
                  {percentLabel}
                </span>
              ) : null}
            </span>
            {subtitle ? (
              <span className="truncate text-[0.62rem] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                {subtitle}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      header: "Тип",
      accessorKey: "task_type",
      meta: {
        width: "clamp(4.5rem, 8vw, 6.5rem)",
        minWidth: "4.5rem",
        maxWidth: "6.5rem",
        cellClassName: "whitespace-nowrap",
      },
      cell: (p) => {
        const value = p.getValue<string>() || "";
        const trimmed = value.trim();
        if (!trimmed) {
          return "";
        }
        const badgeClass = getTypeBadgeClass(trimmed);
        const className = badgeClass || `${fallbackBadgeClass} normal-case`;
        return (
          <span className={className} title={trimmed}>
            {trimmed}
          </span>
        );
      },
    },
    {
      header: "Старт",
      accessorKey: "start_location",
      meta: {
        width: "clamp(5.5rem, 14vw, 9.5rem)",
        minWidth: "5rem",
        maxWidth: "9.5rem",
        cellClassName: "whitespace-nowrap",
      },
      cell: ({ row }) => {
        const name = row.original.start_location || "";
        const trimmed = name.trim();
        const firstToken = trimmed.split(/[\s,;]+/).filter(Boolean)[0] || trimmed;
        const compact = compactText(firstToken, 24);
        const link = row.original.start_location_link;
        return link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={locationLinkBadgeClass}
            title={name}
          >
            <span className="truncate">{compact}</span>
          </a>
        ) : (
          <span title={name} className={locationBadgeClass}>
            <span className="truncate">{compact}</span>
          </span>
        );
      },
    },
    {
      header: "Финиш",
      accessorKey: "end_location",
      meta: {
        width: "clamp(5.5rem, 14vw, 9.5rem)",
        minWidth: "5rem",
        maxWidth: "9.5rem",
        cellClassName: "whitespace-nowrap",
      },
      cell: ({ row }) => {
        const name = row.original.end_location || "";
        const trimmed = name.trim();
        const firstToken = trimmed.split(/[\s,;]+/).filter(Boolean)[0] || trimmed;
        const compact = compactText(firstToken, 24);
        const link = row.original.end_location_link;
        return link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={locationLinkBadgeClass}
            title={name}
          >
            <span className="truncate">{compact}</span>
          </a>
        ) : (
          <span title={name} className={locationBadgeClass}>
            <span className="truncate">{compact}</span>
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
        cellClassName: "whitespace-nowrap text-center sm:text-left",
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
        const badgeClass = getDistanceBadgeClass(raw);
        const className = badgeClass || fallbackBadgeClass;
        return (
          <span className={className} title={`${display} км`}>
            {display}
          </span>
        );
      },
    },
  ];
  return cols;
}
