// Карточка задачи в канбане
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { CarIcon, TruckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { type Task } from 'shared';
import { Button } from '@/components/ui/button';
import {
  DeadlineCountdownBadge,
  fallbackBadgeClass,
  getTypeBadgeClass,
} from '../columns/taskColumns';
import StatusBadge, { mapStatusTone } from './ui/StatusBadge';

interface TaskCardProps {
  task: Task & {
    dueDate?: string;
    due_date?: string;
    due?: string;
    request_id?: string;
    task_number?: string;
  };
  variant?: 'kanban' | 'list';
  onOpen?: (id: string) => void;
}

const titleButtonClass = [
  'group inline-flex w-full items-center gap-2 rounded-md border border-border/40 bg-muted/60 px-2 py-1',
  'text-left text-sm font-semibold text-foreground shadow-xs transition',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  'hover:bg-muted/80 dark:bg-muted/40 dark:hover:bg-muted/50',
].join(' ');

const secondaryTextClass =
  'truncate text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground';

const resolveDueDate = (task: TaskCardProps['task']): string | null => {
  const candidates = [task.dueDate, task.due_date, task.due] as Array<
    string | undefined
  >;
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return null;
};

const resolveStartDate = (task: TaskCardProps['task']): string | null => {
  const source = (task as Record<string, unknown>).start_date;
  if (typeof source === 'string' && source.trim()) {
    return source;
  }
  const camelCase = (task as Record<string, unknown>).startDate;
  if (typeof camelCase === 'string' && camelCase.trim()) {
    return camelCase;
  }
  return null;
};

const resolveCompletedAt = (task: TaskCardProps['task']): string | null => {
  const source = (task as Record<string, unknown>).completed_at;
  if (typeof source === 'string' && source.trim()) {
    return source;
  }
  const camelCase = (task as Record<string, unknown>).completedAt;
  if (typeof camelCase === 'string' && camelCase.trim()) {
    return camelCase;
  }
  return null;
};

const normalizeTaskId = (task: TaskCardProps['task']): string | null => {
  if (typeof task._id === 'string' && task._id.trim()) {
    return task._id.trim();
  }
  if (typeof (task as Record<string, unknown>).id === 'string') {
    const raw = (task as Record<string, unknown>).id as string;
    return raw.trim() ? raw.trim() : null;
  }
  return null;
};

const buildTaskNumber = (task: TaskCardProps['task']): string | null => {
  const candidates = [task.task_number, task.request_id] as Array<
    string | undefined
  >;
  for (const value of candidates) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (/^ERM_\d{6}$/i.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    const digits = trimmed.replace(/\D+/g, '');
    if (digits) {
      const normalized = digits.slice(-6).padStart(6, '0');
      return `ERM_${normalized}`;
    }
  }
  const fallbackId = normalizeTaskId(task);
  if (fallbackId) {
    const safe = fallbackId.replace(/[^0-9A-Z]+/gi, '');
    const normalized = safe.slice(-6).padStart(6, '0').toUpperCase();
    return `ERM_${normalized}`;
  }
  return null;
};

const resolveTypeLabel = (task: TaskCardProps['task']): string | null => {
  const raw = (task as Record<string, unknown>).task_type;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
};

const resolveTransportType = (task: TaskCardProps['task']): string | null => {
  const raw = (task as Record<string, unknown>).transport_type;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === 'без транспорта') return null;
  return trimmed;
};

const resolveTaskTitle = (task: TaskCardProps['task']): string | null => {
  const raw = (task as Record<string, unknown>).title;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
};

const pickTransportIcon = (transportType: string): LucideIcon | null => {
  const normalized = transportType.toLowerCase();
  if (normalized.includes('груз')) {
    return TruckIcon;
  }
  if (normalized.includes('легк')) {
    return CarIcon;
  }
  return CarIcon;
};

export default function TaskCard({
  task,
  variant = 'kanban',
  onOpen,
}: TaskCardProps) {
  const { t } = useTranslation();
  const dueDate = resolveDueDate(task);
  const startDate = resolveStartDate(task);
  const completedAt = resolveCompletedAt(task);
  const taskNumber = buildTaskNumber(task);
  const taskId = normalizeTaskId(task);
  const statusTone = mapStatusTone(task.status);
  const typeLabel = resolveTypeLabel(task);
  const typeClass = typeLabel
    ? (getTypeBadgeClass(typeLabel) ?? `${fallbackBadgeClass} normal-case`)
    : null;
  const transportType = resolveTransportType(task);
  const TransportIcon = transportType ? pickTransportIcon(transportType) : null;
  const titleText = resolveTaskTitle(task) ?? t('kanban.untitled');
  const titleHint = transportType
    ? `${titleText} • ${transportType}`
    : titleText;

  if (variant === 'list') {
    const description =
      typeof (task as Record<string, unknown>).description === 'string'
        ? ((task as Record<string, unknown>).description as string).trim()
        : '';
    return (
      <article className="w-full max-w-[22rem] rounded-lg bg-card p-4 shadow-sm transition-all hover:-translate-y-[3px] hover:shadow-md">
        <h3 className="text-lg font-medium">{titleText}</h3>
        <p className="mt-2 truncate text-sm text-muted-foreground">
          {description || 'Без описания'}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={task.status ?? ''} tone={statusTone} />
            {taskNumber ? (
              <span className="text-xs text-muted-foreground">
                {taskNumber}
              </span>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (taskId) {
                onOpen?.(taskId);
              }
            }}
          >
            Открыть
          </Button>
        </div>
      </article>
    );
  }

  return (
    <div className="flex min-h-[4.5rem] w-full flex-col gap-2 rounded-lg border border-border/70 bg-card/90 p-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-ring/60 focus-within:ring-offset-2 focus-within:ring-offset-background">
      {typeLabel ? (
        <div className="flex items-center justify-between">
          <span className={typeClass}>{typeLabel}</span>
        </div>
      ) : null}
      <button
        type="button"
        className={titleButtonClass}
        title={titleHint}
        onClick={(event) => {
          event.stopPropagation();
          if (taskId) {
            onOpen?.(taskId);
          }
        }}
      >
        {TransportIcon ? (
          <span className="flex items-center justify-center">
            <TransportIcon
              aria-hidden="true"
              className="size-4 text-muted-foreground transition group-hover:text-primary"
            />
            <span className="sr-only">
              {t('kanban.transportIconLabel', { type: transportType })}
            </span>
          </span>
        ) : null}
        <span className="line-clamp-2 text-sm font-semibold leading-snug">
          {titleText}
        </span>
      </button>
      {taskNumber ? (
        <span className={secondaryTextClass}>{taskNumber}</span>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={task.status ?? ''} tone={statusTone} />
        <DeadlineCountdownBadge
          startValue={startDate ?? undefined}
          dueValue={dueDate ?? undefined}
          rawDue={dueDate ?? undefined}
          status={task.status}
          completedAt={completedAt ?? undefined}
        />
      </div>
    </div>
  );
}
