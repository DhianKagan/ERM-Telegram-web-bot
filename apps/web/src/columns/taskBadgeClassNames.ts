// Классы бейджей задач и утилиты; модули: shared
import type { Task } from 'shared';

const badgeBaseClass =
  'inline-flex min-w-0 items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-center text-[0.66rem] font-semibold uppercase tracking-wide shadow-xs';
export const badgeTextClass = 'text-black dark:text-white';

export const buildBadgeClass = (tones: string, extraClass = '') =>
  [badgeBaseClass, 'transition-colors', badgeTextClass, extraClass, tones]
    .filter(Boolean)
    .join(' ');

export const pillBadgeBaseClass =
  'inline-flex max-w-full min-w-0 items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-left text-[0.7rem] font-semibold leading-tight tracking-normal shadow-xs sm:px-1.5 sm:text-[0.76rem]';

export const creatorBadgeClass = `${pillBadgeBaseClass} w-full max-w-full justify-start normal-case ${badgeTextClass} ring-1 ring-blue-500/40 bg-blue-500/15 dark:bg-blue-400/20 dark:ring-blue-300/45`;

export const fallbackBadgeClass = buildBadgeClass(
  'bg-muted/60 ring-1 ring-muted-foreground/30 dark:bg-slate-700/60 dark:ring-slate-500/35',
);

const statusBadgeClassMap: Record<Task['status'], string> = {
  Новая: buildBadgeClass(
    'bg-sky-500/20 ring-1 ring-sky-500/45 dark:bg-sky-400/25 dark:ring-sky-300/45',
  ),
  'В работе': buildBadgeClass(
    'bg-amber-500/25 ring-1 ring-amber-500/45 dark:bg-amber-400/25 dark:ring-amber-300/45',
  ),
  Выполнена: buildBadgeClass(
    'bg-emerald-500/20 ring-1 ring-emerald-500/40 dark:bg-emerald-400/25 dark:ring-emerald-300/45',
  ),
  Отменена: buildBadgeClass(
    'bg-rose-500/20 ring-1 ring-rose-500/40 dark:bg-rose-400/25 dark:ring-rose-300/45',
  ),
};

const urgentPriorityBadgeClass = buildBadgeClass(
  'bg-accent/80 ring-1 ring-destructive/40 dark:bg-accent/60 dark:ring-destructive/40',
);

const highPriorityBadgeClass = buildBadgeClass(
  'bg-accent/75 ring-1 ring-primary/40 dark:bg-accent/55 dark:ring-primary/40',
);

const normalPriorityBadgeClass = buildBadgeClass(
  'bg-accent/65 ring-1 ring-primary/30 dark:bg-accent/45 dark:ring-primary/30',
);

const lowPriorityBadgeClass = buildBadgeClass(
  'bg-accent/50 ring-1 ring-primary/20 dark:bg-accent/35 dark:ring-primary/20',
);

const priorityBadgeClassMap: Record<string, string> = {
  срочно: buildBadgeClass(
    'bg-rose-500/20 ring-1 ring-rose-500/40 dark:bg-rose-400/25 dark:ring-rose-300/45',
  ),
  'в течение дня': buildBadgeClass(
    'bg-sky-500/20 ring-1 ring-sky-500/40 dark:bg-sky-400/25 dark:ring-sky-300/45',
  ),
  'до выполнения': buildBadgeClass(
    'bg-slate-500/25 ring-1 ring-slate-500/45 dark:bg-slate-400/25 dark:ring-slate-300/45',
    'normal-case',
  ),
};

const typeBadgeClassMap: Record<string, string> = {
  доставить: buildBadgeClass(
    'bg-sky-500/20 ring-1 ring-sky-500/40 dark:bg-sky-400/25 dark:ring-sky-300/45',
  ),
  купить: buildBadgeClass(
    'bg-violet-500/20 ring-1 ring-violet-500/40 dark:bg-violet-400/25 dark:ring-violet-300/45',
  ),
  выполнить: buildBadgeClass(
    'bg-emerald-500/20 ring-1 ring-emerald-500/40 dark:bg-emerald-400/25 dark:ring-emerald-300/45',
  ),
  построить: buildBadgeClass(
    'bg-amber-500/25 ring-1 ring-amber-500/45 dark:bg-amber-400/25 dark:ring-amber-300/45',
  ),
  починить: buildBadgeClass(
    'bg-orange-500/20 ring-1 ring-orange-500/40 dark:bg-orange-400/25 dark:ring-orange-300/45',
  ),
};

const hasOwn = <T extends Record<PropertyKey, unknown>>(
  obj: T,
  key: PropertyKey,
): key is keyof T => Object.prototype.hasOwnProperty.call(obj, key);

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
