// Карточка задачи в канбане
import React from "react";
import {
  PROJECT_TIMEZONE,
  PROJECT_TIMEZONE_LABEL,
  type Task,
} from "shared";
import {
  fallbackBadgeClass,
  getStatusBadgeClass,
  getTypeBadgeClass,
} from "../columns/taskColumns";

interface TaskCardProps {
  task: Task & {
    dueDate?: string;
    due_date?: string;
    due?: string;
    request_id?: string;
    task_number?: string;
  };
  onOpen?: (id: string) => void;
}

const numberBadgeClass =
  [
    "inline-flex min-w-[6rem] items-center justify-center gap-1",
    "whitespace-nowrap rounded-full border border-slate-500/30 bg-slate-100/80 px-2 py-1",
    "text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-900 shadow-xs",
    "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "hover:bg-slate-200 dark:border-slate-500/40 dark:bg-slate-700/70 dark:text-slate-100",
    "dark:hover:bg-slate-600/70",
  ].join(" ");

const deadlineBadgeClass =
  "inline-flex min-w-0 items-center gap-1 whitespace-nowrap rounded-full bg-slate-500/10 px-2 py-0.5 text-[0.68rem] font-mono font-semibold leading-tight text-slate-900 ring-1 ring-slate-500/30 shadow-xs dark:bg-slate-500/20 dark:text-slate-100 dark:ring-slate-400/30";

const deadlineFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: PROJECT_TIMEZONE,
});

const resolveDueDate = (
  task: TaskCardProps["task"],
): string | null => {
  const candidates = [task.dueDate, task.due_date, task.due] as Array<
    string | undefined
  >;
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
};

const normalizeTaskId = (task: TaskCardProps["task"]): string | null => {
  if (typeof task._id === "string" && task._id.trim()) {
    return task._id.trim();
  }
  if (typeof (task as Record<string, unknown>).id === "string") {
    const raw = (task as Record<string, unknown>).id as string;
    return raw.trim() ? raw.trim() : null;
  }
  return null;
};

const buildTaskNumber = (task: TaskCardProps["task"]): string | null => {
  const candidates = [task.task_number, task.request_id] as Array<string | undefined>;
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (/^ERM_\d{6}$/i.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    const digits = trimmed.replace(/\D+/g, "");
    if (digits) {
      const normalized = digits.slice(-6).padStart(6, "0");
      return `ERM_${normalized}`;
    }
  }
  const fallbackId = normalizeTaskId(task);
  if (fallbackId) {
    const safe = fallbackId.replace(/[^0-9A-Z]+/gi, "");
    const normalized = safe.slice(-6).padStart(6, "0").toUpperCase();
    return `ERM_${normalized}`;
  }
  return null;
};

const resolveTypeLabel = (task: TaskCardProps["task"]): string | null => {
  const raw = (task as Record<string, unknown>).task_type;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
};

const formatDeadline = (value: string | null): string | null => {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  const label = deadlineFormatter.format(new Date(timestamp)).replace(", ", " ");
  return `${label} ${PROJECT_TIMEZONE_LABEL}`;
};

export default function TaskCard({ task, onOpen }: TaskCardProps) {
  const dueDate = resolveDueDate(task);
  const taskNumber = buildTaskNumber(task);
  const taskId = normalizeTaskId(task);
  const statusClass =
    getStatusBadgeClass(task.status) ?? `${fallbackBadgeClass} uppercase`;
  const typeLabel = resolveTypeLabel(task);
  const typeClass = typeLabel
    ? getTypeBadgeClass(typeLabel) ?? `${fallbackBadgeClass} normal-case`
    : null;
  const deadlineLabel = formatDeadline(dueDate);

  return (
    <div className="flex min-h-[4.5rem] w-full flex-col gap-2 rounded-md border border-border bg-card/80 p-2 shadow-sm transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring/60 focus-within:ring-offset-2 focus-within:ring-offset-background">
      {taskNumber ? (
        <button
          type="button"
          className={numberBadgeClass}
          title={taskNumber}
          onClick={(event) => {
            event.stopPropagation();
            if (taskId) {
              onOpen?.(taskId);
            }
          }}
        >
          <span className="truncate">{taskNumber}</span>
        </button>
      ) : (
        <span className="text-[0.7rem] font-semibold uppercase text-muted-foreground">
          ERM_000000
        </span>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={statusClass}>{task.status}</span>
        {typeLabel ? <span className={typeClass}>{typeLabel}</span> : null}
        {deadlineLabel ? (
          <span className={deadlineBadgeClass} title={deadlineLabel}>
            {deadlineLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
