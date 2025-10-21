// Карточка задачи в канбане
import React from "react";
import type { Task } from "shared";
import {
  fallbackBadgeClass,
  getStatusBadgeClass,
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
    "inline-flex max-w-full min-w-0 items-center justify-center gap-0.5",
    "whitespace-nowrap rounded-full px-1.5 py-0.5 text-left text-[0.7rem]",
    "font-semibold uppercase tracking-[0.18em] text-black shadow-xs",
    "ring-1 ring-slate-500/30 bg-slate-500/10 dark:text-white",
    "dark:bg-slate-500/20 dark:ring-slate-400/30 sm:px-1.5 sm:text-[0.76rem]",
  ].join(" ");

const entityBadgeClass =
  [
    "inline-flex max-w-full min-w-0 items-center gap-0.5",
    "whitespace-nowrap rounded-full px-1.5 py-0.5 text-left text-[0.7rem]",
    "font-semibold leading-tight text-slate-900 shadow-xs",
    "ring-1 ring-slate-500/30 bg-slate-500/10 dark:text-slate-100",
    "dark:bg-slate-500/20 dark:ring-slate-400/30 sm:px-1.5 sm:text-[0.76rem]",
  ].join(" ");

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

const resolveIdentifier = (
  task: TaskCardProps["task"],
): { title: string; short: string } | null => {
  const raw =
    (typeof task.task_number === "string" && task.task_number.trim()) ||
    (typeof task.request_id === "string" && task.request_id.trim()) ||
    (typeof task._id === "string" && task._id.trim()) ||
    "";
  if (!raw) {
    return null;
  }
  const numericMatch = raw.match(/\d+/);
  const short = numericMatch ? numericMatch[0] : raw;
  return { title: raw, short };
};

export default function TaskCard({ task, onOpen }: TaskCardProps) {
  const dueDate = resolveDueDate(task);
  const identifier = resolveIdentifier(task);
  const statusClass =
    getStatusBadgeClass(task.status) ?? `${fallbackBadgeClass} normal-case`;
  const entityLabel =
    typeof task.kind === "string" && task.kind.trim().toLowerCase() === "request"
      ? "Заявка"
      : "Задача";

  return (
    <div className="h-full rounded-lg bg-white p-3 shadow transition-shadow hover:shadow-md">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {identifier ? (
            <button
              type="button"
              className={`${numberBadgeClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
              title={identifier.title}
              onClick={(event) => {
                event.stopPropagation();
                onOpen?.(task._id);
              }}
            >
              <span className="truncate">{identifier.short}</span>
            </button>
          ) : (
            <span className="text-xs text-gray-500">—</span>
          )}
          <span className={entityBadgeClass}>{entityLabel}</span>
        </div>
        <span className={statusClass}>{task.status}</span>
      </div>
      <h4 className="mb-1 line-clamp-2 font-semibold text-slate-900">
        {task.title}
      </h4>
      {dueDate && (
        <p className="text-xs text-gray-500">
          {dueDate.slice(0, 10)}
        </p>
      )}
    </div>
  );
}
