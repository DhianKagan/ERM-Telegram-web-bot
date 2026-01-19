// Назначение файла: единые стили бейджей для таблиц настроек
// Основные модули: SimpleTable badge helpers

export const SETTINGS_BADGE_EMPTY = 'Нет данных';

const badgeBaseClass = [
  'inline-flex min-h-[1.65rem] min-w-0 max-w-[14rem] items-center justify-start gap-1',
  'rounded-full px-3 py-1 text-xs font-semibold leading-tight text-foreground',
  'ring-1 ring-[var(--border)] bg-[var(--bg-muted)] shadow-xs',
  'break-words',
].join(' ');

export const SETTINGS_BADGE_CLASS = `${badgeBaseClass}`;

export const SETTINGS_BADGE_WRAPPER_CLASS =
  'flex flex-wrap items-center gap-1.5';
