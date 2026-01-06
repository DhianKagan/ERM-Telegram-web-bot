// Назначение: управление структурированным логированием и выдачей логов
// Основные модули: pino, path, utils/trace
import path from 'node:path';
import fetch from 'node-fetch';
import pino, {
  type Logger,
  type LoggerOptions,
  type TransportTargetOptions,
} from 'pino';

import { getTrace } from '../utils/trace';

export interface ListLogParams {
  level?: string;
  message?: string;
  from?: string;
  to?: string;
  traceId?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface BufferedLogEntry {
  id: string;
  createdAt: string;
  time: string;
  level: LogLevel;
  message: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

type AllowedLevels = 'debug' | 'info' | 'warn' | 'error' | 'log';
type LogLevel = AllowedLevels;

const allowedLevels = new Set<AllowedLevels>([
  'debug',
  'info',
  'warn',
  'error',
  'log',
]);
const levelToken = Symbol('wgLogLevel');
const defaultBufferSize = Number(process.env.LOG_BUFFER_SIZE ?? 2000);

interface InternalLogEntry extends BufferedLogEntry {
  searchText: string;
}

class LogRingBuffer {
  private readonly capacity: number;

  private readonly entries: InternalLogEntry[] = [];

  constructor(capacity: number) {
    this.capacity =
      Number.isFinite(capacity) && capacity > 0 ? Math.floor(capacity) : 2000;
  }

  add(entry: BufferedLogEntry): void {
    const searchText = this.buildSearchText(entry);
    this.entries.push({ ...entry, searchText });
    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity);
    }
  }

  list(params: ListLogParams = {}): BufferedLogEntry[] {
    const normalizedLevel =
      typeof params.level === 'string' &&
      allowedLevels.has(params.level as AllowedLevels)
        ? (params.level as AllowedLevels)
        : undefined;
    const normalizedTrace =
      typeof params.traceId === 'string' && params.traceId.trim().length
        ? params.traceId.trim()
        : undefined;
    const messageQuery =
      typeof params.message === 'string' && params.message.trim().length
        ? params.message.trim().toLowerCase()
        : undefined;
    const fromTime = parseDate(params.from);
    const toTime = parseDate(params.to);
    const limit = clamp(Number(params.limit) || 100, 1, this.capacity);
    const page = clamp(
      Number(params.page) || 1,
      1,
      Math.ceil(this.entries.length / limit) || 1,
    );

    const filtered = this.entries.filter((entry) => {
      if (normalizedLevel && entry.level !== normalizedLevel) {
        return false;
      }
      if (normalizedTrace && entry.traceId !== normalizedTrace) {
        return false;
      }
      if (messageQuery && !entry.searchText.includes(messageQuery)) {
        return false;
      }
      const time = Date.parse(entry.createdAt);
      if (typeof fromTime === 'number' && time < fromTime) {
        return false;
      }
      if (typeof toTime === 'number' && time > toTime) {
        return false;
      }
      return true;
    });

    const sorted = sortEntries(filtered, params.sort);
    const offset = (page - 1) * limit;
    return sorted.slice(offset, offset + limit).map(stripSearchText);
  }

  private buildSearchText(entry: BufferedLogEntry): string {
    const parts: string[] = [entry.message.toLowerCase()];
    if (entry.traceId) {
      parts.push(entry.traceId.toLowerCase());
    }
    if (entry.metadata) {
      parts.push(JSON.stringify(entry.metadata).toLowerCase());
    }
    return parts.join(' ');
  }
}

function stripSearchText(entry: InternalLogEntry): BufferedLogEntry {
  const { searchText, ...rest } = entry;
  void searchText;
  return rest;
}

function parseDate(value?: string): number | undefined {
  if (!value) return undefined;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : undefined;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return Math.floor(value);
}

function sortEntries(
  entries: InternalLogEntry[],
  sort?: string,
): InternalLogEntry[] {
  const list = [...entries];
  switch (sort) {
    case 'date_asc':
      return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case 'level':
      return list.sort((a, b) => a.level.localeCompare(b.level));
    case 'level_desc':
      return list.sort((a, b) => b.level.localeCompare(a.level));
    default:
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

const buffer = new LogRingBuffer(defaultBufferSize);

function normalizeLevel(level?: string): Exclude<AllowedLevels, 'log'> {
  const value = typeof level === 'string' ? level.toLowerCase() : '';
  if (value === 'debug' || value === 'warn' || value === 'error') return value;
  return 'info';
}

function sanitizeValue(
  value: unknown,
  depth = 0,
  seen: WeakSet<Record<string, unknown>> = new WeakSet(),
): unknown {
  if (value === null || typeof value === 'undefined') return value;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Error) {
    return sanitizeError(value);
  }
  if (Array.isArray(value)) {
    if (depth >= 2) {
      return value
        .slice(0, 5)
        .map((item) => sanitizeValue(item, depth + 1, seen));
    }
    return value
      .slice(0, 20)
      .map((item) => sanitizeValue(item, depth + 1, seen));
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (seen.has(record)) {
      return undefined;
    }
    seen.add(record);
    const entries = Object.entries(record).slice(0, 20);
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of entries) {
      const safe = sanitizeValue(val, depth + 1, seen);
      if (typeof safe !== 'undefined') {
        sanitized[key] = safe;
      }
    }
    seen.delete(record);
    return sanitized;
  }
  return undefined;
}

function sanitizeError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    stack:
      typeof error.stack === 'string'
        ? error.stack.split('\n').slice(0, 15).join('\n')
        : undefined,
  };
}

function extractPayload(args: unknown[]): Pick<
  BufferedLogEntry,
  'message' | 'metadata'
> & {
  levelOverride?: AllowedLevels;
} {
  if (!args.length) {
    return { message: '', metadata: undefined };
  }
  const [first, second, ...rest] = args;
  const seen = new WeakSet<Record<string, unknown>>();
  let message = '';
  let metadata: Record<string, unknown> | undefined;
  let levelOverride: AllowedLevels | undefined;

  if (first instanceof Error) {
    metadata = sanitizeError(first);
    message = typeof second === 'string' ? second : first.message;
  } else if (
    typeof first === 'object' &&
    first !== null &&
    !Array.isArray(first)
  ) {
    const override = (first as Record<PropertyKey, unknown>)[levelToken];
    if (
      typeof override === 'string' &&
      allowedLevels.has(override as AllowedLevels)
    ) {
      levelOverride = override as AllowedLevels;
      delete (first as Record<PropertyKey, unknown>)[levelToken];
    }
    // leave other meta keys intact (we will check for skip marker later)
    metadata = sanitizeValue(first, 0, seen) as
      | Record<string, unknown>
      | undefined;
    if (second instanceof Error) {
      const errorMeta = sanitizeError(second);
      metadata = metadata
        ? { ...metadata, error: errorMeta }
        : { error: errorMeta };
      message = typeof second.message === 'string' ? second.message : '';
    } else if (typeof second === 'string') {
      message = second;
    } else if (typeof second !== 'undefined') {
      message = safeToString(second);
    }
  } else if (typeof first === 'string') {
    message = first;
  } else if (typeof first !== 'undefined') {
    message = safeToString(first);
  }

  if (!message && typeof second === 'string') {
    message = second;
  }

  if (rest.length) {
    const extras = rest
      .map((item) => sanitizeValue(item, 0, seen))
      .filter(
        (item): item is Exclude<typeof item, undefined> =>
          typeof item !== 'undefined',
      );
    if (extras.length) {
      metadata = metadata ? { ...metadata, extra: extras } : { extra: extras };
    }
  }

  if (metadata && !Object.keys(metadata).length) {
    metadata = undefined;
  }

  return { message, metadata, levelOverride };
}

function safeToString(value: unknown): string {
  try {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean')
      return String(value);
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'object') return JSON.stringify(sanitizeValue(value));
    return String(value);
  } catch {
    return '[unserializable]';
  }
}

function buildLogger(): Logger {
  const level = normalizeLevel(process.env.LOG_LEVEL);
  const options: LoggerOptions = {
    level,
    base: { service: 'api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    mixin() {
      const trace = getTrace();
      return trace ? { traceId: trace.traceId } : {};
    },
    hooks: {
      // Основная поправка: в hook-е мы только добавляем в буфер,
      // но прекращаем дублировать запись если в метаданных стоит маркер skip.
      logMethod(args, method) {
        try {
          const timestamp = new Date();
          const methodLevel = (method as unknown as { level?: number }).level;
          const label =
            typeof methodLevel === 'number'
              ? (pino.levels.labels[methodLevel] ?? 'info')
              : 'info';
          const normalized = allowedLevels.has(label as AllowedLevels)
            ? (label as AllowedLevels)
            : 'info';
          const payload = extractPayload(args);
          const trace = getTrace();
          const finalLevel = payload.levelOverride ?? normalized;
          const createdAt = timestamp.toISOString();

          // Если в метаданных поставлен маркер __wgSkipBuffer, то пропускаем запись
          // (это позволяет writeLog сначала положить запись в буфер, а затем вызвать logger
          // без дублирования)
          const skipMarker = payload.metadata && (payload.metadata as any).__wgSkipBuffer;

          if (!skipMarker) {
            buffer.add({
              id: `${timestamp.getTime()}-${Math.random().toString(16).slice(2, 8)}`,
              time: createdAt,
              createdAt,
              level: finalLevel,
              message: payload.message,
              metadata: payload.metadata,
              traceId: trace?.traceId,
            });
          }

          // Логируем обычным способом — pino затем выведет в поток/файл
          method.apply(this, args);
        } catch (err) {
          // Если что-то пошло не так внутри hook-а, не ломаем основной поток.
          try {
            // eslint-disable-next-line no-console
            console.error('wgLogEngine: error in logMethod hook', err);
          } catch {
            // ignore
          }
          method.apply(this, args);
        }
      },
    },
  };

  const targets: TransportTargetOptions[] = [];
  const logDir = process.env.LOG_DIR ?? path.resolve(process.cwd(), 'logs');
  const fileName = process.env.LOG_FILE_NAME ?? 'api.log';
  if (process.env.NODE_ENV !== 'test') {
    targets.push({
      target: 'pino/file',
      level: 'debug',
      options: { destination: path.join(logDir, fileName), mkdir: true },
    });
  }
  if (process.env.LOG_STDOUT !== 'false') {
    targets.push({
      target: 'pino/file',
      level: 'debug',
      options: { destination: 1 },
    });
  }

  if (!targets.length) {
    return pino(options);
  }
  return pino(options, pino.transport({ targets }));
}

const loggingDisabled = process.env.SUPPRESS_LOGS === '1';

const logger: Logger = loggingDisabled
  ? pino({ level: 'silent' })
  : buildLogger();

async function notifySideChannels(
  level: Exclude<AllowedLevels, 'log'>,
  entry: Pick<BufferedLogEntry, 'message' | 'metadata' | 'traceId'>,
): Promise<void> {
  // Отправляем только warn/error
  if (level !== 'warn' && level !== 'error') {
    return;
  }

  const tasks: Promise<unknown>[] = [];

  const webhookUrl = process.env.LOG_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const payload = {
        level,
        message: entry.message,
        metadata: entry.metadata,
        traceId: entry.traceId,
        ts: new Date().toISOString(),
      };
      // Fire-and-forget, но ловим ошибки
      tasks.push(
        fetch(webhookUrl, {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' },
          timeout: Number(process.env.LOG_WEBHOOK_TIMEOUT ?? 5000),
        }).then((res) => {
          if (!res.ok) {
            // eslint-disable-next-line no-console
            console.warn('wgLogEngine: webhook responded not ok', res.status);
          }
        }),
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('wgLogEngine: notify webhook failed', err);
    }
  }

  // Возможное расширение: отправка в Telegram/Slack/... при необходимости.
  try {
    await Promise.allSettled(tasks);
  } catch {
    // ignore
  }
}

/**
 * Основной API:
 *  - writeLog(level, message, metadata?) — добавить в буфер + логер (без дублей)
 *  - listLogs(params) — вернуть из буфера
 *  - getLogger() — вернуть pino logger если нужно
 */

export async function writeLog(
  level: Exclude<AllowedLevels, 'log'>,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const timestamp = new Date();
  const createdAt = timestamp.toISOString();
  const trace = getTrace();

  // Собираем запись и кладём в буфер — этого достаточно для тестов, поиска и выдачи
  const entry: BufferedLogEntry = {
    id: `${timestamp.getTime()}-${Math.random().toString(16).slice(2, 8)}`,
    createdAt,
    time: createdAt,
    level,
    message,
    metadata,
    traceId: trace?.traceId,
  };

  buffer.add(entry);

  // Теперь логируем через pino, но отмечаем метаданные маркером, чтобы hook не дублировал запись.
  const metaWithSkip = metadata ? { ...metadata, __wgSkipBuffer: true } : { __wgSkipBuffer: true };

  try {
    // pino expects logger[level](meta?, msg?) pattern
    // @ts-ignore - index by level string
    const fn: (...args: unknown[]) => void = (logger as any)[level] ?? ((logger as any).info);
    fn.call(logger, metaWithSkip, message);

    // Для warn/error — отправляем side channels (возможно async)
    if (level === 'warn' || level === 'error') {
      // notifySideChannels не должен бросать ошибки наружу
      void notifySideChannels(level, { message, metadata, traceId: trace?.traceId });
    }
  } catch (err) {
    // Если логирование упало — всё равно не ломаем основной поток.
    try {
      // eslint-disable-next-line no-console
      console.error('wgLogEngine: writeLog failed', err);
    } catch {
      // ignore
    }
  }
}

export function listLogs(params: ListLogParams = {}): BufferedLogEntry[] {
  return buffer.list(params);
}

export function getLogger(): Logger {
  return logger;
}

// Экспорт маркера уровня для внутренних вызовов, если нужно задавать уровень в метаданных
export { levelToken as wgLogLevelToken };

// Простой утилитарный метод для тестов/разработки — логирование через writeLog с уровнем 'info'
export async function logInfo(message: string, metadata?: Record<string, unknown>) {
  await writeLog('info', message, metadata);
}
