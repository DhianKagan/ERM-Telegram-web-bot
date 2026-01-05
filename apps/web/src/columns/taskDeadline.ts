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

/**
 * КОМПАКТНЫЙ ФОРМАТ ДЛИТЕЛЬНОСТИ
 *
 * Ранее формат возвращал '5д 5ч' и т.п. — тесты ожидали такой формат.
 * Чтобы убрать многословные метки вроде "дней часов минут" и чтобы
 * бейджи не занимали много места, возвращаем компактный
 * читаемый формат с короткими русскими суффиксами (<= 2 букв):
 *
 *  - дни: 'дн' (паддинг до 2 цифр для соответствия "дд")
 *  - часы: 'ч' или 'чч' (мы выводим с паддингом до 2 цифр)
 *  - минуты: 'м' или 'мм' (паддинг до 2 цифр)
 *
 * Вывод: `DDдн HHч MMм` (в зависимости от значимых частей сокращаем,
 * максимум 2 компонента, как и раньше).
 *
 * Причины:
 *  - компактность в таблицах/карточках,
 *  - предотвращение переносов и "многострочных" бейджей,
 *  - читабельность для локалей.
 */
export const formatDurationShort = (value: number) => {
  if (!Number.isFinite(value) || value === 0) {
    return '0м';
  }
  const abs = Math.abs(value);

  // Разбиваем на дни/часы/минуты
  let rest = abs;
  const days = Math.floor(rest / DAY);
  rest -= days * DAY;
  const hours = Math.floor(rest / HOUR);
  rest -= hours * HOUR;
  const minutes = Math.floor(rest / MINUTE);

  // Вспомогательные: паддинг до 2 цифр (наглядность в таблицах)
  const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

  const parts: string[] = [];

  // Добавляем дни (с суффиксом 'дн'), если есть
  if (days > 0) {
    // День выводим без ведущего нуля если >99 (редкий кейс), обычно pad2 достаточно
    parts.push(`${pad2(days)}дн`);
  }

  // Если ещё нет двух частей — добавляем часы
  if (parts.length < 2 && hours > 0) {
    parts.push(`${pad2(hours)}ч`);
  }

  // Если ещё нет двух частей — добавляем минуты
  if (parts.length < 2 && minutes > 0) {
    parts.push(`${pad2(minutes)}м`);
  }

  // Если ни один компонент не добавлен (интервал < 1 минуты)
  if (parts.length === 0) {
    return '<1м';
  }

  // Ограничение на 2 видимые части — как было ранее
  return parts.slice(0, 2).join(' ');
};
