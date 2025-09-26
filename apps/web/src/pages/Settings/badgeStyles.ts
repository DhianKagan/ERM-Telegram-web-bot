// Назначение файла: единые стили бейджей для таблиц настроек
// Основные модули: DataTable badge helpers

export const SETTINGS_BADGE_EMPTY = "Нет данных";

const badgeBaseClass = [
  "inline-flex min-h-[1.65rem] min-w-0 max-w-full items-center justify-start gap-1",
  "rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold leading-tight text-slate-900",
  "ring-1 ring-slate-300/80 bg-slate-100/95 shadow-xs",
  "dark:text-slate-100 dark:ring-slate-600/60 dark:bg-slate-800/80",
  "truncate",
].join(" ");

export const SETTINGS_BADGE_CLASS = `${badgeBaseClass}`;

export const SETTINGS_BADGE_WRAPPER_CLASS =
  "flex flex-wrap items-center gap-1.5";

