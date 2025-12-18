import React from 'react';

import { cn } from '@/lib/utils';

export type StatusTone = 'new' | 'in_progress' | 'done' | 'canceled' | 'muted';

const STATUS_TONE_MAP: Record<string, StatusTone> = {
  new: 'new',
  новая: 'new',
  draft: 'new',
  pending: 'new',
  in_progress: 'in_progress',
  'in progress': 'in_progress',
  'в работе': 'in_progress',
  active: 'in_progress',
  approved: 'in_progress',
  processing: 'in_progress',
  done: 'done',
  completed: 'done',
  success: 'done',
  выполнена: 'done',
  finished: 'done',
  canceled: 'canceled',
  cancelled: 'canceled',
  отменена: 'canceled',
  отменен: 'canceled',
  rejected: 'canceled',
};

export const mapStatusTone = (
  status: string | null | undefined,
): StatusTone => {
  if (!status) return 'muted';
  const normalized = status.trim().toLowerCase();
  if (!normalized) return 'muted';
  return STATUS_TONE_MAP[normalized] ?? 'muted';
};

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
  tone?: StatusTone;
}

const StatusBadge = ({
  status,
  tone,
  className,
  ...props
}: StatusBadgeProps) => {
  const resolvedTone = tone ?? mapStatusTone(status);
  return (
    <span
      className={cn('ui-status-badge', className)}
      data-tone={resolvedTone}
      aria-label={`Статус: ${status}`}
      {...props}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
