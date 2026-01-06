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
      logMethod(args, method) {
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
        buffer.add({
          id: `${timestamp.getTime()}-${Math.random().toString(16).slice(2, 8)}`,
          time: createdAt,
          createdAt,
          level: finalLevel,
          message: payload.message,
          metadata: payload.metadata,
          traceId: trace?.traceId,
        });
        return method.apply(this, args);
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
    const payload = {
      level,
      message: entry.message,
      metadata: entry.metadata,
      traceId: entry.traceId,
      ts: new Date().toISOString(),
    };
    tasks.push(
      fetch(webhookUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
        timeout: Number(process.env.LOG_WEBHOOK_TIMEOUT ?? 5000),
      }).catch(() => undefined),
    );
  }

  const tgUrl = process.env.LOG_TELEGRAM_BOT_URL;
  const tgChatId = process.env.LOG_TELEGRAM_CHAT_ID;
  if (tgUrl && tgChatId) {
    const prefix = level === 'warn' ? '❗️' : '🔥';
    const chunks: string[] = [];
    chunks.push(`${prefix} <b>${entry.message}</b>`);
    if (entry.traceId) {
      chunks.push(`<b>trace</b>: <code>${entry.traceId}</code>`);
    }
    if (entry.metadata) {
      const plain = entry.metadata
        ? JSON.stringify(entry.metadata, null, 2)
        : '';
      chunks.push(`<pre>${plain}</pre>`);
    }
    const text = chunks.join('\n');

    const params = new URLSearchParams();
    params.set('chat_id', String(tgChatId));
    params.set('parse_mode', 'html');
    params.set('text', text);

    const url = `${tgUrl}?${params.toString()}`;
    tasks.push(
      fetch(url, {
        method: 'GET',
        timeout: Number(process.env.LOG_TELEGRAM_TIMEOUT ?? 5000),
      }).catch(() => undefined),
    );
  }

  await Promise.all(tasks);
}

type WriteLogFn = (
  level: Exclude<AllowedLevels, 'log'> | string,
  message: string,
  metadata?: Record<string, unknown>,
) => Promise<void>;

export interface ListLogFn {
  (params: ListLogParams): BufferedLogEntry[];
}

/**
 * Логирование:
 *
 * - Уровни: 'error', 'debug', 'info', 'warn'
 *   (level case-insensitive)
 * - Сообщение: строка
 * - Метаданные: объект, который будет сериализован и храниться в searchText (в JSON)
 *
 *   Пример: writeLog('error', 'DB connection failed', { port: 5432, db: 'postgres' })
 */
export const writeLogFn: WriteLogFn = async (level, message, metadata) => {
  const normalizedLevel: Exclude<AllowedLevels, 'log'> =
    normalizeLevel(level);
  const trace = getTrace();
  // Пишем в буфер
  const ts = new Date();
  const id = `${ts.getTime()}-${Math.random().toString(16).slice(2, 8)}`;
  const entry: BufferedLogEntry = {
    id,
    createdAt: ts.toISOString(),
    time: ts.toISOString(),
    level: normalizedLevel,
    message,
    metadata,
    traceId: trace?.traceId,
  };
  buffer.add(entry);
  // Логируем через Pino (он снова добавит в буфер в hook, второй раз не страшно)
  if (normalizedLevel === 'error') {
    logger.error({ [levelToken]: 'error', ...metadata }, message);
  } else if (normalizedLevel === 'warn') {
    logger.warn({ [levelToken]: 'warn', ...metadata }, message);
  } else if (normalizedLevel === 'debug') {
    logger.debug({ [levelToken]: 'debug', ...metadata }, message);
  } else {
    logger.info({ [levelToken]: 'info', ...metadata }, message);
  }
  // Отправляем side channels
  await notifySideChannels(normalizedLevel, {
    message,
    metadata,
    traceId: trace?.traceId,
  });
};

export const listLogsFn: ListLogFn = (params = {}) => {
  return buffer.list(params);
};

export { logger, writeLogFn as writeLog, listLogsFn as listLogs };


