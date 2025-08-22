// Назначение: настройка WG Log Engine и вывод логов в разные каналы
// Модули: @wgtechlabs/log-engine, mongoose, fetch
import type { LogMode, EnhancedOutputTarget, LogEngine as EngineType } from '@wgtechlabs/log-engine';
import type { LogDocument } from '../db/model';

export interface ListLogParams {
  level?: string;
  message?: string;
  from?: string;
  to?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

let logger: EngineType;
let writeLogFn: (
  message: string,
  level?: string,
  metadata?: Record<string, unknown>,
) => Promise<void>;
let listLogsFn: (params?: ListLogParams) => Promise<unknown>;

if (process.env.SUPPRESS_LOGS === '1') {
  logger = (console as unknown) as EngineType;
  writeLogFn = async () => {};
  listLogsFn = async () => [];
} else {
  const { Log }: { Log: import('mongoose').Model<LogDocument> } = require('../db/model');
  const {
    LogEngine,
    LogMode,
    EnhancedOutputTarget,
  }: typeof import('@wgtechlabs/log-engine') = require('@wgtechlabs/log-engine');

  const mode = process.env.LOG_LEVEL || 'debug';
  const modes: Record<string, LogMode> = {
    debug: LogMode.DEBUG,
    info: LogMode.INFO,
    warn: LogMode.WARN,
    error: LogMode.ERROR,
  };
  const outputs: EnhancedOutputTarget[] = [
    'console',
    {
      type: 'file',
      config: {
        filePath: './logs/bot.log',
        maxFileSize: 10485760,
        maxBackupFiles: 5,
        append: true,
      },
    },
  ];
  if (process.env.LOG_ERROR_WEBHOOK_URL) {
    outputs.push({
      type: 'http',
      config: { url: process.env.LOG_ERROR_WEBHOOK_URL },
    });
  }
  if (process.env.LOG_TELEGRAM_TOKEN && process.env.LOG_TELEGRAM_CHAT) {
    outputs.push(async (level: string, message: string) => {
      if (level === 'warn' || level === 'error') {
        const text = `⚠️ [${level.toUpperCase()}] ${message}`;
        await fetch(
          `https://api.telegram.org/bot${process.env.LOG_TELEGRAM_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: process.env.LOG_TELEGRAM_CHAT,
              text,
            }),
          },
        );
      }
    });
  }
  logger = LogEngine;
  LogEngine.configure({ mode: modes[mode] || LogMode.DEBUG, enhancedOutputs: outputs });
  LogEngine.configureRedaction({ customPatterns: [/\w{30,}/] });
  writeLogFn = async (
    message: string,
    level = 'info',
    metadata: Record<string, unknown> = {},
  ) => {
    const engine = LogEngine as unknown as Record<
      string,
      (msg: string, meta?: Record<string, unknown>) => void
    >;
    const fn = engine[level] || LogEngine.info;
    fn(message, metadata);
  };
  listLogsFn = (params: ListLogParams = {}) => {
    const { level, message, from, to, sort, page = 1, limit = 100 } = params;
    const allowedLevels = ['debug', 'info', 'warn', 'error', 'log'];
    const filter: Record<string, unknown> = {};
    if (level && allowedLevels.includes(level)) filter.level = { $eq: level };
    if (message) filter.message = { $regex: message, $options: 'i' };
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.$gte = new Date(from);
      if (to) range.$lte = new Date(to);
      filter.createdAt = range;
    }
    let sortObj: Record<string, 1 | -1> = { createdAt: -1 };
    if (sort === 'date_asc') sortObj = { createdAt: 1 };
    if (sort === 'level') sortObj = { level: 1 };
    if (sort === 'level_desc') sortObj = { level: -1 };
    const pageNum = Number(page) > 0 ? Number(page) : 1;
    const lim = Number(limit) > 0 ? Number(limit) : 100;
    return Log.find(filter)
      .sort(sortObj)
      .skip((pageNum - 1) * lim)
      .limit(lim);
  };
}

export { logger, writeLogFn as writeLog, listLogsFn as listLogs };
