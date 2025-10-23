// Конфигурация колонок задач для React Table
// Модули: React, @tanstack/react-table, heroicons, EmployeeLink
import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { PROJECT_TIMEZONE, PROJECT_TIMEZONE_LABEL, type Task } from "shared";
import { QuestionMarkCircleIcon } from "@heroicons/react/20/solid";
import EmployeeLink from "../components/EmployeeLink";
import { getDeadlineState, type DeadlineState } from "./taskDeadline";
import type { User as AppUser } from "../types/user";

// Оформление бейджей статусов и приоритетов на дизайн-токенах
const badgeBaseClass =
  "inline-flex min-w-0 items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-center text-[0.66rem] font-semibold uppercase tracking-wide shadow-xs";
const badgeTextClass = "text-black dark:text-white";

const buildBadgeClass = (tones: string, extraClass = "") =>
  [badgeBaseClass, "transition-colors", badgeTextClass, extraClass, tones]
    .filter(Boolean)
    .join(" ");

const focusableBadgeClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const pillBadgeBaseClass =
  "inline-flex max-w-full min-w-0 items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-left text-[0.7rem] font-semibold leading-tight tracking-normal shadow-xs sm:px-1.5 sm:text-[0.76rem]";

const dateBadgeClass =
  `${pillBadgeBaseClass} font-mono normal-case ${badgeTextClass} ring-1 ring-slate-500/30 bg-slate-500/10 dark:bg-slate-500/20 dark:ring-slate-400/30`;

const dateBadgeTimeClass =
  "text-[0.65rem] font-semibold text-slate-500 dark:text-slate-200";

const numberBadgeClass =
  `${pillBadgeBaseClass} justify-center font-mono uppercase tracking-[0.18em] text-[0.68rem] ${badgeTextClass} ring-1 ring-slate-500/30 bg-slate-500/10 dark:bg-slate-500/20 dark:ring-slate-400/30`;

const titleBadgeClass =
  `${pillBadgeBaseClass} justify-start normal-case ${badgeTextClass} ring-1 ring-indigo-500/40 bg-indigo-500/15 dark:bg-indigo-400/25 dark:ring-indigo-300/45`;

export const creatorBadgeClass =
  `${pillBadgeBaseClass} w-full max-w-full justify-start normal-case ${badgeTextClass} ring-1 ring-blue-500/40 bg-blue-500/15 dark:bg-blue-400/20 dark:ring-blue-300/45`;

const assigneeBadgeClass =
  `${pillBadgeBaseClass} normal-case ${badgeTextClass} ring-1 ring-violet-500/35 bg-violet-500/20 dark:bg-violet-400/30 dark:ring-violet-300/45`;

export const fallbackBadgeClass = buildBadgeClass(
  "bg-muted/60 ring-1 ring-muted-foreground/30 dark:bg-slate-700/60 dark:ring-slate-500/35",
);

const locationBadgeClass =
  `${pillBadgeBaseClass} normal-case ${badgeTextClass} ring-1 ring-emerald-500/30 bg-emerald-500/15 dark:bg-emerald-400/20 dark:ring-emerald-300/30`;

const locationLinkBadgeClass =
  `${locationBadgeClass} ${focusableBadgeClass} no-underline underline-offset-4 hover:underline`;

const statusBadgeClassMap: Record<Task["status"], string> = {
  Новая: buildBadgeClass(
    "bg-sky-500/20 ring-1 ring-sky-500/45 dark:bg-sky-400/25 dark:ring-sky-300/45",
  ),
  "В работе": buildBadgeClass(
    "bg-amber-500/25 ring-1 ring-amber-500/45 dark:bg-amber-400/25 dark:ring-amber-300/45",
  ),
  Выполнена: buildBadgeClass(
    "bg-emerald-500/20 ring-1 ring-emerald-500/40 dark:bg-emerald-400/25 dark:ring-emerald-300/45",
  ),
  Отменена: buildBadgeClass(
    "bg-rose-500/20 ring-1 ring-rose-500/40 dark:bg-rose-400/25 dark:ring-rose-300/45",
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
  ),
  'в течение дня': buildBadgeClass(
    "bg-sky-500/20 ring-1 ring-sky-500/40 dark:bg-sky-400/25 dark:ring-sky-300/45",
  ),
  'до выполнения': buildBadgeClass(
    "bg-slate-500/25 ring-1 ring-slate-500/45 dark:bg-slate-400/25 dark:ring-slate-300/45",
    "normal-case",
  ),
};

const hasOwn = <T extends Record<PropertyKey, unknown>>(obj: T, key: PropertyKey): key is keyof T =>
  Object.prototype.hasOwnProperty.call(obj, key);

export const getStatusBadgeClass = (value: string) => {
  if (hasOwn(statusBadgeClassMap, value)) {
    return statusBadgeClassMap[value];
  }
  return null;
};

export const getPriorityBadgeClass = (value: string) => {
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

const completionNoteTextClass =
  "text-[11px] font-medium text-slate-600 dark:text-slate-300";

const typeBadgeClassMap: Record<string, string> = {
  доставить: buildBadgeClass(
    "bg-sky-500/20 ring-1 ring-sky-500/40 dark:bg-sky-400/25 dark:ring-sky-300/45",
  ),
  купить: buildBadgeClass(
    "bg-violet-500/20 ring-1 ring-violet-500/40 dark:bg-violet-400/25 dark:ring-violet-300/45",
  ),
  выполнить: buildBadgeClass(
    "bg-emerald-500/20 ring-1 ring-emerald-500/40 dark:bg-emerald-400/25 dark:ring-emerald-300/45",
  ),
  построить: buildBadgeClass(
    "bg-amber-500/25 ring-1 ring-amber-500/45 dark:bg-amber-400/25 dark:ring-amber-300/45",
  ),
  починить: buildBadgeClass(
    "bg-orange-500/20 ring-1 ring-orange-500/40 dark:bg-orange-400/25 dark:ring-orange-300/45",
  ),
};

export const getTypeBadgeClass = (value: string) => {
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
);

const mediumDistanceBadgeClass = buildBadgeClass(
  "bg-sky-500/20 ring-1 ring-sky-500/40 dark:bg-sky-400/25 dark:ring-sky-300/45",
);

const longDistanceBadgeClass = buildBadgeClass(
  "bg-amber-500/25 ring-1 ring-amber-500/45 dark:bg-amber-400/25 dark:ring-amber-300/45",
);

const extraLongDistanceBadgeClass = buildBadgeClass(
  "bg-rose-500/20 ring-1 ring-rose-500/40 dark:bg-rose-400/25 dark:ring-rose-300/45",
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
  timeZone: PROJECT_TIMEZONE,
});

const datePartFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: PROJECT_TIMEZONE,
});

const timePartFmt = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: PROJECT_TIMEZONE,
});

const parseDateInput = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value?: string) => {
  const date = parseDateInput(value);
  if (!date) return null;
  const full = `${fullDateTimeFmt.format(date).replace(", ", " ")} ${PROJECT_TIMEZONE_LABEL}`;
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

export type EntityKind = "task" | "request";

export interface TaskRow extends Task {
  id: string;
  created_by?: number | string | null;
  createdBy?: number | string | null;
  creator?: number | string | null;
  assigned_user_id?: number | null;
  assignees?: number[];
  start_date?: string | null;
  due_date?: string | null;
  start_location?: string | null;
  start_location_link?: string | null;
  end_location?: string | null;
  end_location_link?: string | null;
}

type EntityCase = "nominative" | "accusative" | "genitive";

const ENTITY_WORDS: Record<EntityKind, Record<EntityCase, string>> = {
  task: {
    nominative: "Задача",
    accusative: "Задачу",
    genitive: "задачи",
  },
  request: {
    nominative: "Заявка",
    accusative: "Заявку",
    genitive: "заявки",
  },
};

const entityWord = (
  kind: EntityKind,
  form: EntityCase,
  options?: { lower?: boolean },
) => {
  const base = ENTITY_WORDS[kind][form];
  return options?.lower ? base.toLowerCase() : base;
};

const resolveEntityKind = (
  value: unknown,
  fallback: EntityKind,
): EntityKind => {
  if (typeof value === "string" && value.trim().toLowerCase() === "request") {
    return "request";
  }
  return fallback;
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");

type CountdownLikeState = Extract<
  DeadlineState,
  { kind: "countdown" | "pending" | "overdue" }
>;

const countdownBadgeBaseClass = `${pillBadgeBaseClass} min-w-0 justify-start normal-case ${badgeTextClass} tabular-nums ring-1`;

const countdownToneClassMap: Record<
  "safe" | "warn" | "danger" | "overdue" | "pending",
  string
> = {
  safe: `${countdownBadgeBaseClass} bg-emerald-500/25 ring-emerald-500/45 dark:bg-emerald-400/25 dark:ring-emerald-300/45`,
  warn: `${countdownBadgeBaseClass} bg-amber-500/25 ring-amber-500/45 dark:bg-amber-400/25 dark:ring-amber-300/45`,
  danger: `${countdownBadgeBaseClass} bg-orange-500/25 ring-orange-500/45 dark:bg-orange-400/25 dark:ring-orange-300/45`,
  overdue: `${countdownBadgeBaseClass} bg-rose-500/30 ring-rose-500/55 dark:bg-rose-400/30 dark:ring-rose-300/50`,
  pending: `${countdownBadgeBaseClass} bg-sky-500/20 ring-sky-500/45 dark:bg-sky-400/25 dark:ring-sky-300/45`,
};

const neutralCountdownBadgeClass = `${countdownBadgeBaseClass} bg-slate-500/15 ring-slate-500/35 dark:bg-slate-500/25 dark:ring-slate-400/35`;

const formatCountdownParts = (remainingMs: number) => {
  const absValue = Math.abs(remainingMs);
  const totalMinutes = Math.max(0, Math.floor(absValue / (60 * 1000)));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return {
    days,
    hours,
    minutes,
    paddedDays: pad(days),
    paddedHours: pad(hours),
    paddedMinutes: pad(minutes),
  };
};

const getRussianPlural = (
  value: number,
  forms: [string, string, string],
) => {
  const absValue = Math.abs(value) % 100;
  if (absValue >= 11 && absValue <= 14) {
    return forms[2];
  }
  const lastDigit = absValue % 10;
  if (lastDigit === 1) {
    return forms[0];
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return forms[1];
  }
  return forms[2];
};

const getCountdownToneKey = (
  state: CountdownLikeState,
): keyof typeof countdownToneClassMap => {
  if (state.kind === "overdue") {
    return "overdue";
  }
  if (state.kind === "pending") {
    return "pending";
  }
  return state.level;
};

const buildCountdownLabel = (state: CountdownLikeState) => {
  const { days, hours, minutes } = formatCountdownParts(state.remainingMs);
  if (state.kind === "overdue") {
    return `Просрочено на ${days} ${getRussianPlural(days, [
      "день",
      "дня",
      "дней",
    ])} ${hours} ${getRussianPlural(hours, [
      "час",
      "часа",
      "часов",
    ])} ${minutes} ${getRussianPlural(minutes, [
      "минута",
      "минуты",
      "минут",
    ])}`;
  }
  if (state.kind === "pending") {
    return `Начало через ${days} ${getRussianPlural(days, [
      "день",
      "дня",
      "дней",
    ])} ${hours} ${getRussianPlural(hours, [
      "час",
      "часа",
      "часов",
    ])} ${minutes} ${getRussianPlural(minutes, [
      "минута",
      "минуты",
      "минут",
    ])}`;
  }
  return `До дедлайна ${days} ${getRussianPlural(days, [
    "день",
    "дня",
    "дней",
  ])} ${hours} ${getRussianPlural(hours, [
    "час",
    "часа",
    "часов",
  ])} ${minutes} ${getRussianPlural(minutes, [
    "минута",
    "минуты",
    "минут",
  ])}`;
};

const buildCountdownTitle = (
  state: CountdownLikeState,
  formatted: ReturnType<typeof formatDate>,
  rawDue?: string,
) => {
  if (!formatted) {
    return rawDue ? rawDue.trim() : undefined;
  }
  if (state.kind === "overdue") {
    return `Просрочено с ${formatted.full}`;
  }
  if (state.kind === "pending") {
    const note =
      state.issue === "missing-start"
        ? "Не указана дата начала"
        : "Диапазон дат некорректен";
    return `${note}. Срок ${formatted.full}`;
  }
  return `Выполнить до ${formatted.full}`;
};

const COMPLETION_THRESHOLD_MS = 60_000;

const formatCompletionOffset = (diffMs: number) => {
  const absValue = Math.abs(diffMs);
  if (absValue < COMPLETION_THRESHOLD_MS) {
    return "менее минуты";
  }
  const { days, hours, minutes } = formatCountdownParts(absValue);
  const parts: string[] = [];
  if (days) {
    parts.push(`${days} ${getRussianPlural(days, ["день", "дня", "дней"])}`);
  }
  if (hours) {
    parts.push(
      `${hours} ${getRussianPlural(hours, ["час", "часа", "часов"])}`,
    );
  }
  if (minutes && parts.length < 2) {
    parts.push(
      `${minutes} ${getRussianPlural(minutes, ["минута", "минуты", "минут"])}`,
    );
  }
  if (!parts.length) {
    return "менее минуты";
  }
  return parts.slice(0, 2).join(" ");
};

const buildCompletionNote = (
  status: Task["status"] | undefined,
  dueValue?: string,
  completedValue?: string | null,
) => {
  if (status !== "Выполнена") {
    return null;
  }
  const dueDate = parseDateInput(dueValue);
  const completedDate = parseDateInput(completedValue);
  if (!dueDate || !completedDate) {
    return null;
  }
  const diff = completedDate.getTime() - dueDate.getTime();
  if (!Number.isFinite(diff)) {
    return null;
  }
  if (Math.abs(diff) < COMPLETION_THRESHOLD_MS) {
    return "Выполнена точно в срок";
  }
  const offset = formatCompletionOffset(diff);
  if (!offset) {
    return "Выполнена точно в срок";
  }
  return diff < 0
    ? `Выполнена досрочно на ${offset}`
    : `Выполнена с опозданием на ${offset}`;
};

// Fast Refresh обрабатывает вспомогательные компоненты как часть конфигурации таблицы
// eslint-disable-next-line react-refresh/only-export-components
export function DeadlineCountdownBadge({
  startValue,
  dueValue,
  rawDue,
  status,
  completedAt,
}: {
  startValue?: string;
  dueValue?: string;
  rawDue?: string;
  status?: Task["status"];
  completedAt?: string | null;
}) {
  const completedDate = React.useMemo(
    () => parseDateInput(completedAt),
    [completedAt],
  );
  const isCompleted = status === "Выполнена";

  const [now, setNow] = React.useState<Date>(
    () => completedDate ?? new Date(),
  );

  React.useEffect(() => {
    if (isCompleted) {
      if (completedDate) {
        setNow(completedDate);
      }
      return;
    }
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [isCompleted, completedDate, startValue, dueValue]);

  const referenceDate = completedDate ?? now;

  const state = React.useMemo(
    () => getDeadlineState(startValue, dueValue, referenceDate),
    [startValue, dueValue, referenceDate],
  );

  const formatted = React.useMemo(() => formatDate(dueValue), [dueValue]);
  const completionNote = React.useMemo(
    () => buildCompletionNote(status, dueValue, completedAt),
    [status, dueValue, completedAt],
  );

  if (state.kind === "invalid") {
    return (
      <span
        className={`${neutralCountdownBadgeClass} inline-flex items-center gap-1.5`}
        title={
          state.reason === "missing"
            ? "Срок не назначен"
            : "Срок указан некорректно"
        }
      >
        <QuestionMarkCircleIcon
          className="size-4 flex-shrink-0 text-black dark:text-white"
          aria-hidden
        />
        <span className="truncate">Нет данных</span>
      </span>
    );
  }

  const toneKey = getCountdownToneKey(state);
  const className = countdownToneClassMap[toneKey];
  const parts = formatCountdownParts(state.remainingMs);
  const label = buildCountdownLabel(state);
  const title = completionNote
    ? `${completionNote}. ${buildCountdownTitle(state, formatted, rawDue)}`
    : buildCountdownTitle(state, formatted, rawDue);
  return (
    <span
      className={`${className} inline-flex items-center gap-1.5`}
      title={title}
    >
      <span className="sr-only">{label}</span>
      <span
        aria-hidden
        className="flex items-end gap-1 text-black dark:text-white"
      >
        <span className="flex flex-col items-center leading-tight">
          <span className="text-[0.8rem] font-semibold tabular-nums">
            {parts.paddedDays}
          </span>
          <span className="text-[9px] font-medium text-black/80 dark:text-white/80">
            {getRussianPlural(parts.days, ["день", "дня", "дней"])}
          </span>
        </span>
        <span className="flex flex-col items-center leading-tight">
          <span className="text-[0.8rem] font-semibold tabular-nums">
            {parts.paddedHours}
          </span>
          <span className="text-[9px] font-medium text-black/80 dark:text-white/80">
            {getRussianPlural(parts.hours, ["час", "часа", "часов"])}
          </span>
        </span>
        <span className="flex flex-col items-center leading-tight">
          <span className="text-[0.8rem] font-semibold tabular-nums">
            {parts.paddedMinutes}
          </span>
          <span className="text-[9px] font-medium text-black/80 dark:text-white/80">
            {getRussianPlural(parts.minutes, ["минута", "минуты", "минут"])}
          </span>
        </span>
      </span>
      {completionNote ? (
        <span className="sr-only">{completionNote}</span>
      ) : null}
    </span>
  );
}

const durationToneClassMap: Record<
  "completed" | "cancelled" | "active" | "planned" | "idle",
  string
> = {
  completed: `${countdownBadgeBaseClass} bg-emerald-500/25 ring-emerald-500/45 dark:bg-emerald-400/25 dark:ring-emerald-300/45`,
  cancelled: `${countdownBadgeBaseClass} bg-rose-500/30 ring-rose-500/55 dark:bg-rose-400/30 dark:ring-rose-300/50`,
  active: `${countdownBadgeBaseClass} bg-amber-500/25 ring-amber-500/45 dark:bg-amber-400/25 dark:ring-amber-300/45`,
  planned: `${countdownBadgeBaseClass} bg-sky-500/20 ring-sky-500/45 dark:bg-sky-400/25 dark:ring-sky-300/45`,
  idle: neutralCountdownBadgeClass,
};

const formatDurationPhrase = (
  parts: ReturnType<typeof formatCountdownParts>,
  variant: "completed" | "running",
  entityKind: EntityKind,
) => {
  const { days, hours, minutes } = parts;
  if (!days && !hours && !minutes) {
    return variant === "completed"
      ? `${entityWord(entityKind, "nominative")} завершена менее чем за минуту`
      : "Затрачено менее минуты";
  }
  const dayLabel = `${days} ${getRussianPlural(days, [
    "день",
    "дня",
    "дней",
  ])}`;
  const hourLabel = `${hours} ${getRussianPlural(hours, [
    "час",
    "часа",
    "часов",
  ])}`;
  const minuteLabel = `${minutes} ${getRussianPlural(minutes, [
    "минута",
    "минуты",
    "минут",
  ])}`;
  const phrase = `${dayLabel} ${hourLabel} ${minuteLabel}`;
  return variant === "completed"
    ? `${entityWord(entityKind, "nominative")} завершена за ${phrase}`
    : `Затрачено ${phrase}`;
};

const buildDurationTitle = (
  variant: "completed" | "running" | "idle",
  startValue?: string,
  endValue?: string,
  parts?: ReturnType<typeof formatCountdownParts>,
  entityKind: EntityKind = "task",
) => {
  const titleParts: string[] = [];
  const startFormatted = startValue ? formatDate(startValue) : null;
  const endFormatted = endValue ? formatDate(endValue) : null;
  if (startFormatted) {
    titleParts.push(`Начало: ${startFormatted.full}`);
  }
  if (endFormatted) {
    titleParts.push(
      variant === "completed"
        ? `Завершено: ${endFormatted.full}`
        : `Текущее время: ${endFormatted.full}`,
    );
  }
  if (parts) {
    const phrase = formatDurationPhrase(
      parts,
      variant === "completed" ? "completed" : "running",
      entityKind,
    );
    const normalized =
      variant === "completed"
        ? phrase.replace(
            new RegExp(
              `^${escapeRegExp(
                `${entityWord(entityKind, "nominative")} завершена за `,
              )}`,
            ),
            "Продолжительность: ",
          )
        : phrase.replace(/^Затрачено\s/, "Продолжительность: ");
    titleParts.push(
      variant === "idle" ? `Продолжительность: ${phrase}` : normalized,
    );
  }
  if (!titleParts.length) {
    return variant === "idle"
      ? "Продолжительность появится после указания даты начала"
      : "Нет данных о продолжительности";
  }
  return titleParts.join("\n");
};

type ActualTimeCellProps = {
  progressStartValue?: string | null;
  plannedStartValue?: string | null;
  completedValue?: string | null;
  status?: Task["status"];
  entityKind: EntityKind;
};

// eslint-disable-next-line react-refresh/only-export-components
function ActualTimeCell({
  progressStartValue,
  plannedStartValue,
  completedValue,
  status,
  entityKind,
}: ActualTimeCellProps) {
  const plannedStartDate = React.useMemo(
    () => parseDateInput(plannedStartValue),
    [plannedStartValue],
  );
  const progressStartDate = React.useMemo(
    () => parseDateInput(progressStartValue),
    [progressStartValue],
  );
  const completedDate = React.useMemo(
    () => parseDateInput(completedValue),
    [completedValue],
  );
  const isFinished = status === "Выполнена" || status === "Отменена";
  const isCancelled = status === "Отменена";
  const isNotStarted = status === "Новая";

  const timerStartDate = React.useMemo(() => {
    if (isNotStarted) {
      return null;
    }
    return progressStartDate ?? plannedStartDate ?? null;
  }, [isNotStarted, progressStartDate, plannedStartDate]);

  const [referenceDate, setReferenceDate] = React.useState<Date>(() => {
    if (isFinished && completedDate) {
      return completedDate;
    }
    return new Date();
  });

  React.useEffect(() => {
    if (isFinished) {
      if (completedDate) {
        setReferenceDate(completedDate);
      }
      return undefined;
    }
    if (!timerStartDate) {
      return undefined;
    }
    const update = () => setReferenceDate(new Date());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [isFinished, completedDate, timerStartDate]);

  const effectiveEndDate = isFinished && completedDate
    ? completedDate
    : referenceDate;
  const durationMs = timerStartDate
    ? Math.max(0, effectiveEndDate.getTime() - timerStartDate.getTime())
    : null;
  const durationParts = React.useMemo(() => {
    if (isNotStarted) {
      return formatCountdownParts(0);
    }
    return durationMs !== null ? formatCountdownParts(durationMs) : null;
  }, [durationMs, isNotStarted]);

  const endIso = React.useMemo(() => effectiveEndDate.toISOString(), [
    effectiveEndDate,
  ]);

  const variant: "completed" | "running" | "idle" =
    isNotStarted || !timerStartDate
      ? "idle"
      : isFinished
      ? "completed"
      : "running";

  const toneKey: keyof typeof durationToneClassMap =
    isNotStarted || !timerStartDate
      ? "idle"
      : isFinished
      ? isCancelled
        ? "cancelled"
        : "completed"
      : status === "В работе"
      ? "active"
      : "planned";

  const label = isNotStarted
    ? `${entityWord(entityKind, "nominative")} ещё не начата`
    : durationParts
    ? formatDurationPhrase(
        durationParts,
        variant === "completed" ? "completed" : "running",
        entityKind,
      )
    : "Продолжительность появится после начала";

  const startValueForTooltip =
    progressStartValue ?? plannedStartValue ?? undefined;

  const durationBadgeTitle = isNotStarted
    ? `Таймер запустится после перевода ${entityWord(entityKind, "genitive", { lower: true })} в статус «В работе»`
    : buildDurationTitle(
        variant,
        startValueForTooltip,
        variant === "completed" ? completedValue ?? undefined : endIso,
        durationParts ?? undefined,
        entityKind,
      );

  const renderStopBadge = () => {
    if (isFinished && completedDate && completedValue) {
      return renderDateCell(completedValue);
    }
    if (isFinished) {
      return (
        <span className={dateBadgeClass} title="Нет отметки о завершении">
          <span className="truncate">Нет данных</span>
        </span>
      );
    }
    if (!timerStartDate) {
      const placeholder =
        status === "Новая"
          ? "Не начата"
          : status === "В работе"
          ? "В работе"
          : "В ожидании";
      const title =
        status === "Новая"
          ? `${entityWord(entityKind, "nominative")} ещё не начата`
          : status === "В работе"
          ? "Таймер запустится после фиксации начала"
          : "Дата начала отсутствует";
      return (
        <span className={dateBadgeClass} title={title}>
          <span className="truncate">{placeholder}</span>
        </span>
      );
    }
    const placeholder = status === "В работе" ? "В работе" : "В ожидании";
    return (
      <span
        className={dateBadgeClass}
        title={`${entityWord(entityKind, "nominative")} ещё не завершена`}
      >
        <span className="truncate">{placeholder}</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col items-start gap-1">
      {renderStopBadge()}
      <span
        className={`${durationToneClassMap[toneKey]} inline-flex items-center gap-1.5`}
        title={durationBadgeTitle}
      >
        <span className="sr-only">{label}</span>
        {durationParts ? (
          <span
            aria-hidden
            className="flex items-end gap-1 text-black dark:text-white"
          >
            <span className="flex flex-col items-center leading-tight">
              <span className="text-[0.8rem] font-semibold tabular-nums">
                {durationParts.paddedDays}
              </span>
              <span className="text-[9px] font-medium text-black/80 dark:text-white/80">
                {getRussianPlural(durationParts.days, [
                  "день",
                  "дня",
                  "дней",
                ])}
              </span>
            </span>
            <span className="flex flex-col items-center leading-tight">
              <span className="text-[0.8rem] font-semibold tabular-nums">
                {durationParts.paddedHours}
              </span>
              <span className="text-[9px] font-medium text-black/80 dark:text-white/80">
                {getRussianPlural(durationParts.hours, [
                  "час",
                  "часа",
                  "часов",
                ])}
              </span>
            </span>
            <span className="flex flex-col items-center leading-tight">
              <span className="text-[0.8rem] font-semibold tabular-nums">
                {durationParts.paddedMinutes}
              </span>
              <span className="text-[9px] font-medium text-black/80 dark:text-white/80">
                {getRussianPlural(durationParts.minutes, [
                  "минута",
                  "минуты",
                  "минут",
                ])}
              </span>
            </span>
          </span>
        ) : (
          <span className="text-xs font-medium text-black dark:text-white">
            {label}
          </span>
        )}
      </span>
    </div>
  );
}

export default function taskColumns(
  users: Record<number, AppUser>,
  defaultKind: EntityKind = "task",
): ColumnDef<TaskRow>[] {
  const cols: ColumnDef<TaskRow>[] = [
    {
      header: "Номер",
      id: "number",
      accessorFn: (row) => {
        const rowKind = resolveEntityKind(row.kind, defaultKind);
        const rawValue =
          rowKind === "request"
            ? row.request_id || row.task_number || row._id
            : row.task_number || row.request_id || row._id;
        if (typeof rawValue === "string") {
          return rawValue;
        }
        if (rawValue === undefined || rawValue === null) {
          return "";
        }
        return String(rawValue);
      },
      meta: {
        width: "clamp(4.25rem, 8vw, 6.25rem)",
        minWidth: "4rem",
        maxWidth: "6.5rem",
        cellClassName:
          "whitespace-nowrap text-center font-mono tabular-nums sm:text-left sm:pl-1.5",
        headerClassName: "whitespace-nowrap text-center sm:text-left",
      },
      cell: (p) => {
        const row = p.row.original as TaskRow;
        const rowKind = resolveEntityKind(row.kind, defaultKind);
        const value = (p.getValue<string>() || "").trim();
        const fallback =
          rowKind === "request"
            ? (row.request_id as string | undefined) ??
              (row.task_number as string | undefined) ??
              String(row._id)
            : (row.task_number as string | undefined) ??
              (row.request_id as string | undefined) ??
              String(row._id);
        const display = value || fallback || "";
        const numericMatch = display.match(/\d+/);
        const shortValue = numericMatch ? numericMatch[0] : display;
        return (
          <span className={`${numberBadgeClass} justify-center`} title={display}>
            <span className="truncate">{shortValue}</span>
          </span>
        );
      },
    },
    {
      header: `${entityWord(defaultKind, "accusative")} создал`,
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
        width: "clamp(8rem, 18vw, 18rem)",
        minWidth: "7rem",
        maxWidth: "18rem",
        cellClassName: "align-top",
      },
      cell: (p) => {
        const v = p.getValue<string>() || "";
        const compact = compactText(v, 72);
        const row = p.row.original as TaskRow;
        const completionNote = buildCompletionNote(
          row.status,
          row.due_date ?? undefined,
          row.completed_at ?? undefined,
        );
        return (
          <div className="flex flex-col items-start gap-1">
            <span
              title={v}
              className={`${titleBadgeClass} whitespace-normal`}
            >
              <span
                className="block max-w-full break-words text-left leading-snug"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {compact}
              </span>
            </span>
            {completionNote ? (
              <span className={completionNoteTextClass}>{completionNote}</span>
            ) : null}
          </div>
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
        const ids = Array.isArray(row.original.assignees)
          ? row.original.assignees
          : typeof row.original.assigned_user_id === "number"
          ? [row.original.assigned_user_id]
          : [];
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
      header: "Дедлайн",
      accessorKey: "due_date",
      meta: {
        width: "clamp(10.5rem, 20vw, 15.5rem)",
        minWidth: "10rem",
        maxWidth: "16.5rem",
        cellClassName: "whitespace-nowrap text-xs sm:text-sm",
      },
      cell: (p) => {
        const dueValue = p.getValue<string>();
        const row = p.row.original;
        const countdown = (
          <DeadlineCountdownBadge
            startValue={row.start_date ?? undefined}
            dueValue={row.due_date ?? undefined}
            rawDue={dueValue}
            status={row.status}
            completedAt={row.completed_at ?? undefined}
          />
        );
        if (!dueValue) {
          return countdown;
        }
        const dateCell = renderDateCell(dueValue);
        if (typeof dateCell === "string") {
          if (!dateCell) {
            return countdown;
          }
          return (
            <div className="flex flex-col items-start gap-1">
              {dateCell ? <span>{dateCell}</span> : null}
              {countdown}
            </div>
          );
        }
        return (
          <div className="flex flex-col items-start gap-1">
            {dateCell}
            {countdown}
          </div>
        );
      },
    },
    {
      header: "Время выполнения",
      accessorKey: "completed_at",
      meta: {
        width: "clamp(10.5rem, 20vw, 15.5rem)",
        minWidth: "10rem",
        maxWidth: "16.5rem",
        cellClassName: "whitespace-nowrap text-xs sm:text-sm",
      },
      cell: (p) => {
        const row = p.row.original;
        const rowKind = resolveEntityKind(row.kind, defaultKind);
        return (
          <ActualTimeCell
            progressStartValue={row.in_progress_at ?? undefined}
            plannedStartValue={row.start_date ?? undefined}
            completedValue={p.getValue<string | null>() ?? undefined}
            status={row.status}
            entityKind={rowKind}
          />
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
        const name = row.original.start_location ?? "";
        const trimmed = name.trim();
        const firstToken = trimmed.split(/[\s,;]+/).filter(Boolean)[0] || trimmed;
        const compact = compactText(firstToken, 24);
        const link = row.original.start_location_link ?? undefined;
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
        const name = row.original.end_location ?? "";
        const trimmed = name.trim();
        const firstToken = trimmed.split(/[\s,;]+/).filter(Boolean)[0] || trimmed;
        const compact = compactText(firstToken, 24);
        const link = row.original.end_location_link ?? undefined;
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
