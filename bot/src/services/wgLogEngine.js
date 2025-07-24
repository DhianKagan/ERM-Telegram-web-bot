// Назначение: настройка WG Log Engine и вывод логов в разные каналы
// Модули: @wgtechlabs/log-engine, mongoose, node:process, fetch
const { Log } = require('../db/model');
const { LogEngine, LogMode } = require('@wgtechlabs/log-engine');

const mode = process.env.LOG_LEVEL || 'debug';
const modes = {
  debug: LogMode.DEBUG,
  info: LogMode.INFO,
  warn: LogMode.WARN,
  error: LogMode.ERROR,
};
const outputs = [
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
  async (level, message) => {
    await Log.create({ message, level });
  },
];

if (process.env.LOG_ERROR_WEBHOOK_URL) {
  outputs.push({
    type: 'http',
    config: { url: process.env.LOG_ERROR_WEBHOOK_URL },
  });
}

if (process.env.LOG_TELEGRAM_TOKEN && process.env.LOG_TELEGRAM_CHAT) {
  outputs.push(async (level, message) => {
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

LogEngine.configure({
  mode: modes[mode] || LogMode.DEBUG,
  enhancedOutputs: outputs,
});

LogEngine.configureRedaction({ customPatterns: [/[\w-]{30,}/] });

async function writeLog(message, level = 'info', metadata = {}) {
  LogEngine.log(level, message, metadata);
}

async function listLogs() {
  return Log.find().sort({ createdAt: -1 }).limit(100);
}

module.exports = { writeLog, listLogs, logger: LogEngine };
