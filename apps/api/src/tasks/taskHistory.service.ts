// Назначение: формирование текста истории задач для Telegram
// Основные модули: db/model, db/queries, shared, utils/userLink, utils/mdEscape
import { PROJECT_TIMEZONE_LABEL } from 'shared';
import { type HistoryEntry } from '../db/model';
import { escapeMarkdownV2 as mdEscape } from '../utils/mdEscape';

const emptyObject = Object.freeze({}) as Record<string, unknown>;

const fieldNames: Record<string, string> = {
  status: 'статус',
  deadline: 'срок',
  due: 'срок',
  completed_at: 'выполнено',
  assignees: 'исполнители',
  description: 'описание',
  title: 'название',
  comment: 'комментарий',
};

const hiddenFields = new Set(['comment']);

const fieldDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

const numberFormatter = new Intl.NumberFormat('ru-RU');

function parseFixedOffset(label: string): number | null {
  const normalized = label.trim().toUpperCase();
  const match = /^(?:GMT|UTC)([+-])(\d{1,2})(?::(\d{2}))?$/.exec(normalized);
  if (!match) {
    return null;
  }
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number.parseInt(match[2], 10);
  const minutes = match[3] ? Number.parseInt(match[3], 10) : 0;
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return sign * ((hours * 60 + minutes) * 60 * 1000);
}

const fixedOffsetMs = parseFixedOffset(PROJECT_TIMEZONE_LABEL);

function applyFixedOffset(date: Date): Date {
  if (fixedOffsetMs === null) {
    return date;
  }
  return new Date(date.getTime() + fixedOffsetMs);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeForCompare(value: unknown): unknown {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed) && /\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return new Date(parsed).getTime();
    }
    return trimmed;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeForCompare(item))
      .map((item) => (typeof item === 'string' ? item.trim() : item))
      .sort((a, b) => {
        const left = typeof a === 'string' ? a : JSON.stringify(a);
        const right = typeof b === 'string' ? b : JSON.stringify(b);
        return left.localeCompare(right);
      });
  }
  if (isObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeForCompare(value[key]);
        return acc;
      }, {});
  }
  return value ?? null;
}

function formatDate(value: Date): string {
  return fieldDateFormatter.format(applyFixedOffset(value)).replace(', ', ' ');
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) return null;
    return new Date(parsed);
  }
  return null;
}

function formatPrimitiveValue(value: unknown): string {
  if (value === null || typeof value === 'undefined') {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'да' : 'нет';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—';
    return numberFormatter.format(value);
  }
  if (value instanceof Date) {
    return formatDate(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '—';
    const date = parseDate(trimmed);
    if (date) {
      return formatDate(date);
    }
    return trimmed;
  }
  if (Array.isArray(value)) {
    if (!value.length) return '—';
    const items = value
      .map((item) => formatPrimitiveValue(item))
      .filter((item) => item && item !== '—');
    if (!items.length) return '—';
    return items.join(', ');
  }
  if (isObject(value)) {
    const json = JSON.stringify(value);
    return json ? json : '—';
  }
  return String(value);
}

function formatFieldName(field: string): string {
  const key = field.trim();
  const mapped = fieldNames[key] ?? key.replace(/_/g, ' ');
  return mdEscape(mapped);
}

interface FormatFieldValueOptions {
  escapeDatesFully?: boolean;
}

function formatFieldValue(
  value: unknown,
  options: FormatFieldValueOptions = {},
): string {
  const primitive = formatPrimitiveValue(value);
  const escaped = mdEscape(primitive);

  const isFormattedDate = primitive
    .split(', ')
    .every((part) => /^\d{2}\.\d{2}\.\d{4}(?: \d{2}:\d{2})?$/.test(part));

  if (isFormattedDate && !options.escapeDatesFully) {
    return escaped.replace(/\\\.(\d{4})(?!\d)/g, '.$1');
  }

  return escaped;
}

interface DescribeActionOptions {
  escapeDatesFully?: boolean;
}

export type ActionKind = 'created' | 'status' | 'updated';

export interface ActionDescription {
  kind: ActionKind;
  details: string | null;
}

export function describeAction(
  entry: HistoryEntry,
  options: DescribeActionOptions = {},
): ActionDescription {
  const to = (entry.changes?.to && isObject(entry.changes?.to))
    ? (entry.changes?.to as Record<string, unknown>)
    : emptyObject;
  const from = (entry.changes?.from && isObject(entry.changes?.from))
    ? (entry.changes?.from as Record<string, unknown>)
    : emptyObject;
  const hasChanges = Object.keys(to).length > 0 || Object.keys(from).length > 0;
  if (!hasChanges) {
    return { kind: 'created', details: 'задача создана' };
  }
  const keys = Array.from(
    new Set([...Object.keys(from), ...Object.keys(to)]),
  ).sort();
  const changedKeys = keys.filter((key) => {
    const nextValue = to[key];
    const prevValue = from[key];
    return (
      JSON.stringify(normalizeForCompare(nextValue)) !==
      JSON.stringify(normalizeForCompare(prevValue))
    );
  });
  if (!changedKeys.length) {
    return { kind: 'updated', details: null };
  }
  if (changedKeys.some((key) => hiddenFields.has(key))) {
    return { kind: 'updated', details: null };
  }
  if (changedKeys.includes('status')) {
    const fieldName = formatFieldName('status');
    const previous = formatFieldValue(from.status, options);
    const next = formatFieldValue(to.status, options);
    return { kind: 'status', details: `${fieldName}: «${previous}» → «${next}»` };
  }
  return { kind: 'updated', details: null };
}

