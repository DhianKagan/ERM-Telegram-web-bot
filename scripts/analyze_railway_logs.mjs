#!/usr/bin/env node
/**
 * Назначение: анализ логов деплоев Railway и генерация рекомендаций по улучшению.
 * Модули: fs, path, os.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

function printUsage() {
  const message = `Использование: node scripts/analyze_railway_logs.mjs <путь_к_логу> [--prefix <имя>] [--output-dir <каталог>] [--json <файл>] [--markdown <файл>]

Скрипт читает лог деплоя Railway, подсчитывает ошибки и предлагает улучшения.
Если файлы вывода не указаны, используются значения на основе prefix.`;
  console.error(message);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
        continue;
      }
      args[key] = next;
      i += 1;
    } else {
      args._.push(arg);
    }
  }
  return args;
}

function normalizeMessage(line) {
  return line
    .replace(/^[^A-Za-zА-Яа-я0-9]+/, '')
    .replace(
      /\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?\s*/u,
      '',
    )
    .replace(/^\[[^\]]+\]\s*/, '')
    .trim();
}

function extractContext(lines, index) {
  const context = [];
  const start = Math.max(0, index - 2);
  const end = Math.min(lines.length, index + 3);
  for (let i = start; i < end; i += 1) {
    if (i === index) {
      continue;
    }
    const value = lines[i].trim();
    if (value) {
      context.push(value);
    }
  }
  return context.slice(0, 5);
}

const RECOMMENDATIONS = {
  lint: {
    id: 'lint',
    title: 'Прогнать линтер',
    command: 'pnpm lint',
    autoRun: true,
    reason:
      'Ошибки уровня TypeError/ReferenceError часто выявляются линтером до деплоя.',
  },
  testApi: {
    id: 'test-api',
    title: 'Запустить API-тесты',
    command: 'pnpm test:api',
    autoRun: true,
    reason:
      'API-тесты помогают воспроизвести ошибки бизнес-логики, найденные в логах.',
  },
  checkMongo: {
    id: 'check-mongo',
    title: 'Проверить подключение к MongoDB',
    command: 'node scripts/check_mongo.mjs',
    autoRun: true,
    reason:
      'Логи содержат проблемы подключения к MongoDB; проверяем доступность базы.',
  },
  reviewValidation: {
    id: 'review-validation',
    title: 'Проверить схемы валидации',
    autoRun: false,
    reason:
      'Обнаружены ValidationError — требуется сверить схемы DTO и ответы API.',
  },
  investigateTimeout: {
    id: 'investigate-timeout',
    title: 'Проверить таймауты запросов',
    autoRun: false,
    reason:
      'Во время деплоя возникали таймауты — убедитесь, что внешние сервисы доступны и таймауты увеличены.',
  },
  inspectTelegram: {
    id: 'inspect-telegram',
    title: 'Проверить вебхук Telegram',
    autoRun: false,
    reason:
      'Ошибки Telegram API — убедитесь, что вебхук и токен бота заданы корректно.',
  },
  memoryProfile: {
    id: 'memory-profile',
    title: 'Проанализировать потребление памяти',
    autoRun: false,
    reason:
      'Обнаружены признаки нехватки памяти, проанализируйте нагрузку и оптимизируйте код.',
  },
  portInUse: {
    id: 'port-in-use',
    title: 'Проверить занятые порты',
    autoRun: false,
    reason:
      'Приложение не смогло занять порт — проверьте фоновые процессы и конфигурацию Railway.',
  },
  formatCode: {
    id: 'format-code',
    title: 'Форматировать код',
    command: 'pnpm format',
    autoRun: true,
    reason:
      'Логи содержат ошибки форматирования. Прогоним Prettier, чтобы автоматически привести код к стандарту проекта.',
  },
};

const PATTERNS = [
  {
    id: 'type-error',
    regex:
      /(TypeError|ReferenceError|SyntaxError|is not defined|Cannot read properties|Cannot set properties)/i,
    recommendationIds: ['lint', 'testApi'],
  },
  {
    id: 'unhandled-rejection',
    regex: /UnhandledPromiseRejection|Unhandled rejection|Unhandled error/i,
    recommendationIds: ['testApi'],
  },
  {
    id: 'mongo-connection',
    regex:
      /(Mongo(Network)?Error|failed to connect to server|ECONNREFUSED.*27017)/i,
    recommendationIds: ['checkMongo'],
  },
  {
    id: 'validation-error',
    regex: /ValidationError|invalid input|BadRequestException/i,
    recommendationIds: ['reviewValidation', 'testApi'],
  },
  {
    id: 'timeout',
    regex: /(ETIMEDOUT|TimeoutError|timed out|took too long)/i,
    recommendationIds: ['investigateTimeout'],
  },
  {
    id: 'telegram-error',
    regex: /telegram\s*(bot)?\s*api|ETELEGRAM|400 Bad Request: webhook/i,
    recommendationIds: ['inspectTelegram'],
  },
  {
    id: 'memory',
    regex: /(OutOfMemory|JavaScript heap out of memory|ENOMEM)/i,
    recommendationIds: ['memoryProfile'],
  },
  {
    id: 'port',
    regex: /EADDRINUSE|address already in use/i,
    recommendationIds: ['portInUse'],
  },
  {
    id: 'formatting',
    regex:
      /(Run \w+ lint --fix|Run pnpm lint --fix|Formatting issues detected|Prettier failed|Delete ␍|Expected indentation of|Insert `;`)/i,
    recommendationIds: ['formatCode'],
  },
];

function buildOutputPaths({
  logPath,
  prefix,
  outputDir,
  jsonPath,
  markdownPath,
}) {
  const resolvedOutputDir = outputDir
    ? path.resolve(outputDir)
    : path.resolve('Railway', 'analysis');
  fs.mkdirSync(resolvedOutputDir, { recursive: true });

  const safePrefix = prefix
    ? prefix
    : path.basename(logPath).replace(/\.[^.]+$/, '');
  const timestamp = new Date().toISOString().replace(/[:]/g, '-');
  const baseName = `${safePrefix}-${timestamp}`;

  const resolvedJson = jsonPath
    ? path.resolve(jsonPath)
    : path.join(resolvedOutputDir, `${baseName}.json`);
  const resolvedMarkdown = markdownPath
    ? path.resolve(markdownPath)
    : path.join(resolvedOutputDir, `${baseName}.md`);

  return {
    outputDir: resolvedOutputDir,
    jsonPath: resolvedJson,
    markdownPath: resolvedMarkdown,
    baseName,
  };
}

function summarizeEntries(map, limit = 5) {
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function renderMarkdown({
  logPath,
  stats,
  errors,
  warnings,
  recommendations,
  jsonPath,
  baseName,
}) {
  const lines = [];
  lines.push(`# Анализ логов ${baseName}`);
  lines.push('');
  lines.push(`- Файл лога: ${logPath}`);
  lines.push(`- Всего строк: ${stats.totalLines}`);
  lines.push(`- Ошибок: ${stats.errors}`);
  lines.push(`- Предупреждений: ${stats.warnings}`);
  lines.push(`- Информационных сообщений: ${stats.infos}`);
  lines.push('');

  if (errors.length) {
    lines.push('## Ключевые ошибки');
    errors.forEach((entry, index) => {
      lines.push(
        `${index + 1}. **${entry.message}** — ${entry.count} повторов.`,
      );
      if (entry.samples.length) {
        lines.push('   - Примеры:');
        entry.samples.forEach((sample) => {
          lines.push(`     - \`${sample}\``);
        });
      }
      if (entry.context.length) {
        lines.push('   - Контекст:');
        entry.context.forEach((ctx) => {
          lines.push(`     - ${ctx}`);
        });
      }
    });
    lines.push('');
  } else {
    lines.push('## Ключевые ошибки');
    lines.push('Ошибки уровня ERROR не обнаружены.');
    lines.push('');
  }

  if (warnings.length) {
    lines.push('## Предупреждения');
    warnings.forEach((entry, index) => {
      lines.push(`${index + 1}. ${entry.message} — ${entry.count} повторов.`);
    });
    lines.push('');
  }

  if (recommendations.length) {
    lines.push('## Рекомендации по улучшению');
    recommendations.forEach((rec) => {
      const auto = rec.autoRun ? ' (будет выполнено автоматически)' : '';
      lines.push(
        `- ${rec.title}${auto}: ${rec.reason}${rec.command ? ` — команда: \`${rec.command}\`` : ''}`,
      );
    });
    lines.push('');
  } else {
    lines.push('## Рекомендации по улучшению');
    lines.push('Дополнительных действий не требуется.');
    lines.push('');
  }

  lines.push('---');
  lines.push(
    `Отчёт сформирован автоматически скриптом \`scripts/analyze_railway_logs.mjs\`. JSON: ${jsonPath}`,
  );
  lines.push('');

  return lines.join(os.EOL);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args._.length) {
    printUsage();
    process.exit(1);
  }

  const logPath = path.resolve(args._[0]);
  if (!fs.existsSync(logPath)) {
    console.error(`Файл лога не найден: ${logPath}`);
    process.exit(1);
  }

  const logContent = fs.readFileSync(logPath, 'utf8');
  const lines = logContent.split(/\r?\n/);

  const stats = {
    totalLines: lines.length,
    errors: 0,
    warnings: 0,
    infos: 0,
  };

  const errorMap = new Map();
  const warnMap = new Map();
  const triggeredRecommendations = new Map();

  lines.forEach((line, index) => {
    if (!line) {
      return;
    }
    const severity = (() => {
      if (/\b(ERROR|ERR|FATAL)\b/i.test(line) || /\bException\b/i.test(line)) {
        return 'error';
      }
      if (/\b(WARN|WARNING)\b/i.test(line)) {
        return 'warn';
      }
      if (/\b(INFO|DEBUG|LOG)\b/i.test(line)) {
        return 'info';
      }
      if (/Error:/i.test(line)) {
        return 'error';
      }
      return null;
    })();

    if (severity === 'error') {
      stats.errors += 1;
    } else if (severity === 'warn') {
      stats.warnings += 1;
    } else if (severity === 'info') {
      stats.infos += 1;
    }

    PATTERNS.forEach((pattern) => {
      if (pattern.regex.test(line)) {
        pattern.recommendationIds.forEach((recId) => {
          const rec = RECOMMENDATIONS[recId];
          if (rec) {
            triggeredRecommendations.set(rec.id, rec);
          }
        });
      }
    });

    if (severity === 'error') {
      const normalized = normalizeMessage(line);
      const entry = errorMap.get(normalized) || {
        message: normalized,
        count: 0,
        samples: [],
        context: [],
      };
      entry.count += 1;
      if (entry.samples.length < 3 && !entry.samples.includes(line.trim())) {
        entry.samples.push(line.trim());
      }
      if (entry.context.length < 3) {
        const context = extractContext(lines, index);
        context.forEach((ctx) => {
          if (!entry.context.includes(ctx)) {
            entry.context.push(ctx);
          }
        });
      }
      errorMap.set(normalized, entry);
    }

    if (severity === 'warn') {
      const normalized = normalizeMessage(line);
      const entry = warnMap.get(normalized) || {
        message: normalized,
        count: 0,
      };
      entry.count += 1;
      warnMap.set(normalized, entry);
    }
  });

  const topErrors = summarizeEntries(errorMap);
  const topWarnings = summarizeEntries(warnMap);
  const recommendations = Array.from(triggeredRecommendations.values());

  const { outputDir, jsonPath, markdownPath, baseName } = buildOutputPaths({
    logPath,
    prefix: args.prefix,
    outputDir: args['output-dir'],
    jsonPath: args.json,
    markdownPath: args.markdown,
  });

  const markdown = renderMarkdown({
    logPath,
    stats,
    errors: topErrors,
    warnings: topWarnings,
    recommendations,
    jsonPath,
    baseName,
  });
  fs.writeFileSync(markdownPath, markdown, 'utf8');

  const jsonPayload = {
    logPath,
    baseName,
    generatedAt: new Date().toISOString(),
    stats,
    errors: topErrors,
    warnings: topWarnings,
    recommendations,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(jsonPayload, null, 2), 'utf8');

  process.stdout.write(JSON.stringify({ jsonPath, markdownPath, outputDir }));
}

main();
