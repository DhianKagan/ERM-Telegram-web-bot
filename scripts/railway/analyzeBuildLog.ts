// Назначение: анализ логов сборки Railway и поиск самых долгих шагов.
// Основные модули: node:fs/promises, node:path, process.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface RawEntry {
  readonly stage: string;
  readonly operation: string;
  readonly durationMs: number;
  readonly rawDuration: string;
  readonly lineNumber: number;
}

interface AggregatedEntry {
  readonly stage: string;
  readonly operation: string;
  totalMs: number;
  count: number;
  maxMs: number;
}

interface CliOptions {
  readonly inputPath?: string;
  readonly top: number;
  readonly showHelp: boolean;
}

const durationTokenRegex = /(\d+(?:\.\d+)?)(ms|s|m|h)/gi;
const stageNameRegex = /^[a-z0-9-]+$/i;

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));

  if (options.showHelp) {
    printHelp();
    return;
  }

  try {
    const rawLog = await readInput(options.inputPath);

    const entries = collectEntries(rawLog);

    if (entries.length === 0) {
      console.log('В журнале не найдено шагов с длительностью.');
      return;
    }

    const aggregated = aggregateEntries(entries);
    const stageTotals = sumByStage(entries);

    printAggregated(aggregated, options.top);
    printStageTotals(stageTotals);
  } catch (error) {
    process.exitCode = 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Ошибка: ${message}`);
  }
}

function parseCliArgs(argv: readonly string[]): CliOptions {
  let top = 10;
  let inputPath: string | undefined;
  let showHelp = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      showHelp = true;
      continue;
    }

    if (arg.startsWith('--top=')) {
      const value = Number.parseInt(arg.slice('--top='.length), 10);
      if (!Number.isNaN(value) && value > 0) {
        top = value;
      }
      continue;
    }

    if (arg === '--top') {
      const next = argv[index + 1];
      if (typeof next === 'string') {
        const value = Number.parseInt(next, 10);
        if (!Number.isNaN(value) && value > 0) {
          top = value;
        }
        index += 1;
        continue;
      }
    }

    if (inputPath === undefined) {
      inputPath = arg;
      continue;
    }

    throw new Error(`Неизвестный аргумент: ${arg}`);
  }

  return { inputPath, top, showHelp };
}

function printHelp(): void {
  console.log(
    `Использование: pnpm ts-node scripts/railway/analyzeBuildLog.ts [опции] [файл]\n\n` +
      `Опции:\n` +
      `  --top <n>     Показать N самых долгих операций (по умолчанию 10).\n` +
      `  -h, --help    Вывести эту справку.\n\n` +
      `Если файл не указан, скрипт читает журнал из stdin.`,
  );
}

async function readInput(inputPath?: string): Promise<string> {
  if (inputPath && inputPath !== '-') {
    const fullPath = resolve(process.cwd(), inputPath);
    return await readFile(fullPath, 'utf8');
  }

  if (process.stdin.isTTY) {
    throw new Error('Не указан файл и не передан поток stdin.');
  }

  return await new Promise<string>((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = [];

    process.stdin.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    process.stdin.on('end', () => {
      resolvePromise(Buffer.concat(chunks).toString('utf8'));
    });

    process.stdin.on('error', (streamError: Error) => {
      rejectPromise(streamError);
    });
  });
}

function collectEntries(rawLog: string): RawEntry[] {
  const lines = rawLog.split(/\r?\n/);
  const entries: RawEntry[] = [];

  let currentStage = 'неопределено';
  let lastOperation = '';

  for (let index = 0; index < lines.length; index += 1) {
    const originalLine = lines[index];
    const trimmedLine = originalLine.trim();

    if (trimmedLine === '') {
      continue;
    }

    if (stageNameRegex.test(trimmedLine) && trimmedLine.indexOf(' ') === -1) {
      currentStage = trimmedLine;
      lastOperation = '';
      continue;
    }

    const tookMatch = trimmedLine.match(/\[took ([^\]]+)\]/i);

    if (tookMatch) {
      const duration = parseDurationToken(tookMatch[1]);
      if (duration !== null) {
        const operation =
          trimmedLine.replace(/\s*\[took [^\]]+\]\s*/i, '').trim() ||
          lastOperation ||
          currentStage;
        entries.push({
          stage: currentStage,
          operation,
          durationMs: duration,
          rawDuration: tookMatch[1].trim(),
          lineNumber: index + 1,
        });
        lastOperation = operation;
        continue;
      }
    }

    const standaloneDuration = parseStandaloneDuration(trimmedLine);

    if (standaloneDuration !== null) {
      const operation = lastOperation || currentStage;
      entries.push({
        stage: currentStage,
        operation,
        durationMs: standaloneDuration,
        rawDuration: trimmedLine,
        lineNumber: index + 1,
      });
      continue;
    }

    lastOperation = trimmedLine;
  }

  return entries;
}

function parseStandaloneDuration(value: string): number | null {
  const duration = parseDurationToken(value);
  if (duration === null) {
    return null;
  }

  const sanitized = value.replace(durationTokenRegex, '').trim();
  if (sanitized.length > 0) {
    return null;
  }

  return duration;
}

function parseDurationToken(value: string): number | null {
  const matches = Array.from(value.matchAll(durationTokenRegex));

  if (matches.length === 0) {
    return null;
  }

  let totalMs = 0;

  for (const match of matches) {
    const amount = Number.parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    if (Number.isNaN(amount)) {
      return null;
    }

    switch (unit) {
      case 'h': {
        totalMs += amount * 60 * 60 * 1000;
        break;
      }
      case 'm': {
        totalMs += amount * 60 * 1000;
        break;
      }
      case 's': {
        totalMs += amount * 1000;
        break;
      }
      case 'ms': {
        totalMs += amount;
        break;
      }
      default: {
        return null;
      }
    }
  }

  return totalMs;
}

function aggregateEntries(entries: readonly RawEntry[]): AggregatedEntry[] {
  const grouped = new Map<string, AggregatedEntry>();

  for (const entry of entries) {
    const operationKey = `${entry.stage}||${entry.operation}`;
    const existing = grouped.get(operationKey);

    if (existing) {
      existing.totalMs += entry.durationMs;
      existing.count += 1;
      existing.maxMs = Math.max(existing.maxMs, entry.durationMs);
    } else {
      grouped.set(operationKey, {
        stage: entry.stage,
        operation: entry.operation,
        totalMs: entry.durationMs,
        count: 1,
        maxMs: entry.durationMs,
      });
    }
  }

  return Array.from(grouped.values()).sort(
    (left, right) => right.totalMs - left.totalMs,
  );
}

function sumByStage(
  entries: readonly RawEntry[],
): Array<{ stage: string; totalMs: number }> {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    totals.set(entry.stage, (totals.get(entry.stage) ?? 0) + entry.durationMs);
  }

  return Array.from(totals.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([stage, totalMs]) => ({ stage, totalMs }));
}

function printAggregated(
  entries: readonly AggregatedEntry[],
  top: number,
): void {
  const limit = Math.min(top, entries.length);
  console.log(`ТОП-${limit} операций по суммарной длительности:`);

  for (let index = 0; index < limit; index += 1) {
    const entry = entries[index];
    const averageMs = entry.totalMs / entry.count;
    const parts = [
      `${index + 1}. ${entry.stage} — ${entry.operation}`,
      `суммарно ${formatDuration(entry.totalMs)}`,
    ];

    if (entry.count > 1) {
      parts.push(`среднее ${formatDuration(averageMs)}`);
    }

    parts.push(`пик ${formatDuration(entry.maxMs)}`);

    console.log(parts.join(', '));
  }

  console.log('');
}

function printStageTotals(
  stageTotals: Array<{ stage: string; totalMs: number }>,
): void {
  console.log('Суммарное время по стадиям:');
  for (const { stage, totalMs } of stageTotals) {
    console.log(`- ${stage}: ${formatDuration(totalMs)}`);
  }
}

function formatDuration(inputMs: number): string {
  const roundedMs = Math.round(inputMs);

  if (roundedMs >= 60 * 1000) {
    const minutes = Math.floor(roundedMs / (60 * 1000));
    const seconds = Math.round((roundedMs - minutes * 60 * 1000) / 1000);
    if (seconds === 0) {
      return `${minutes}м`;
    }
    return `${minutes}м ${seconds}с`;
  }

  if (roundedMs >= 1000) {
    const seconds = roundedMs / 1000;
    if (seconds >= 10) {
      return `${Math.round(seconds)}с`;
    }
    return `${seconds.toFixed(1)}с`;
  }

  if (roundedMs >= 100) {
    return `${roundedMs}мс`;
  }

  return `${roundedMs}мс`;
}

void main();
