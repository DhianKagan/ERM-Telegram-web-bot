// Классы бейджей задач и утилиты; модули: shared
import type { Task } from 'shared';

const badgeBaseClass =
  'inline-flex min-w-0 items-center gap-0.5 whitespace-nowrap rounded-full px-3 py-1 text-center text-xs font-semibold tracking-wide shadow-xs';
export const badgeTextClass = 'text-foreground';

export const buildBadgeClass = (tones: string, extraClass = '') =>
  [badgeBaseClass, 'transition-colors', badgeTextClass, extraClass, tones]
    .filter(Boolean)
    .join(' ');

const toneBadgeClass = (
  tone: 'primary' | 'success' | 'danger' | 'neutral',
  extraClass = '',
) => {
  const toneMap = {
    primary:
      'text-[var(--color-primary)] ring-1 ring-[color:var(--color-primary)]/30 bg-[color:var(--color-primary)]/10',
    success:
      'text-[var(--color-success)] ring-1 ring-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/10',
    danger:
      'text-[var(--color-danger)] ring-1 ring-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/10',
    neutral:
      'text-[var(--color-muted)] ring-1 ring-[var(--border)] bg-[var(--bg-muted)]',
  } satisfies Record<string, string>;
  return buildBadgeClass(toneMap[tone], extraClass);
};

export const pillBadgeBaseClass =
  'inline-flex max-w-[14rem] min-w-0 items-center gap-0.5 whitespace-normal rounded-full px-3 py-1 text-left text-xs font-semibold leading-tight tracking-normal shadow-xs';

export const creatorBadgeClass = `${pillBadgeBaseClass} w-full max-w-full justify-start normal-case ${badgeTextClass} ring-1 ring-[color:var(--color-primary)]/30 bg-[color:var(--color-primary)]/10`;

export const fallbackBadgeClass = 'ui-status-badge ui-status-badge--muted';

const statusBadgeClassMap: Record<Task['status'], string> = {
  Новая: 'ui-status-badge ui-status-badge--new',
  'В работе': 'ui-status-badge ui-status-badge--in_progress',
  Выполнена: 'ui-status-badge ui-status-badge--done',
  Отменена: 'ui-status-badge ui-status-badge--canceled',
};

const urgentPriorityBadgeClass = toneBadgeClass('danger');
const highPriorityBadgeClass = toneBadgeClass('primary');
const normalPriorityBadgeClass = toneBadgeClass('neutral');
const lowPriorityBadgeClass = toneBadgeClass('neutral');

const priorityBadgeClassMap: Record<string, string> = {
  срочно: toneBadgeClass('danger'),
  'в течение дня': toneBadgeClass('primary'),
  'до выполнения': toneBadgeClass('neutral', 'normal-case'),
};

const typeBadgeClassMap: Record<string, string> = {
  доставить: toneBadgeClass('primary'),
  купить: toneBadgeClass('primary'),
  выполнить: toneBadgeClass('success'),
  построить: toneBadgeClass('primary'),
  починить: toneBadgeClass('primary'),
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
