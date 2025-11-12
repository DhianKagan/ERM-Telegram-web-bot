// Назначение файла: функции расчёта и форматирования сроков задач.
// Основные модули: стандартный объект Date.

export type DeadlineLevel = 'safe' | 'warn' | 'danger';

type PendingIssue = 'missing-start' | 'invalid-range';

type InvalidReason = 'missing' | 'invalid';

export interface DeadlineStateBase {
  dueDate: Date | null;
  startDate: Date | null;
  remainingMs: number | null;
}

export interface CountdownState extends DeadlineStateBase {
  kind: 'countdown';
  remainingMs: number;
  ratio: number;
  level: DeadlineLevel;
}

export interface PendingState extends DeadlineStateBase {
  kind: 'pending';
  remainingMs: number;
  issue: PendingIssue;
}

export interface OverdueState extends DeadlineStateBase {
  kind: 'overdue';
  remainingMs: number;
}

export interface InvalidState extends DeadlineStateBase {
  kind: 'invalid';
  reason: InvalidReason;
}

export type DeadlineState =
  | CountdownState
  | PendingState
  | OverdueState
  | InvalidState;

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

const parseDateValue = (value?: string) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const clampRatio = (value: number) => {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  if (value < 0) {
    return 0;
  }
  return value;
};

export const getDeadlineState = (
  startValue?: string,
  dueValue?: string,
  referenceDate = new Date(),
): DeadlineState => {
  const dueDate = parseDateValue(dueValue);
  const startDate = parseDateValue(startValue);

  if (!dueDate) {
    return {
      kind: 'invalid',
      reason: dueValue ? 'invalid' : 'missing',
      dueDate: null,
      startDate,
      remainingMs: null,
    };
  }

  const remainingMs = dueDate.getTime() - referenceDate.getTime();

  if (remainingMs < 0) {
    return {
      kind: 'overdue',
      dueDate,
      startDate,
      remainingMs,
    };
  }

  if (!startDate) {
    return {
      kind: 'pending',
      issue: 'missing-start',
      dueDate,
      startDate: null,
      remainingMs,
    };
  }

  if (startDate.getTime() >= dueDate.getTime()) {
    return {
      kind: 'pending',
      issue: 'invalid-range',
      dueDate,
      startDate,
      remainingMs,
    };
  }

  const totalMs = dueDate.getTime() - startDate.getTime();
  const ratio = clampRatio(remainingMs / totalMs);
  let level: DeadlineLevel;
  if (ratio > 0.6) {
    level = 'safe';
  } else if (ratio >= 0.2) {
    level = 'warn';
  } else {
    level = 'danger';
  }

  return {
    kind: 'countdown',
    ratio,
    level,
    dueDate,
    startDate,
    remainingMs,
  };
};

export const formatDurationShort = (value: number) => {
  if (!Number.isFinite(value) || value === 0) {
    return '0м';
  }
  const abs = Math.abs(value);
  const parts: string[] = [];
  let rest = abs;

  const pushPart = (divisor: number, suffix: string) => {
    const amount = Math.floor(rest / divisor);
    if (amount > 0) {
      parts.push(`${amount}${suffix}`);
      rest -= amount * divisor;
    }
  };

  pushPart(DAY, 'д');
  if (parts.length < 2) {
    pushPart(HOUR, 'ч');
  }
  if (parts.length < 2) {
    pushPart(MINUTE, 'м');
  }

  if (parts.length === 0) {
    return '<1м';
  }

  return parts.slice(0, 2).join(' ');
};
