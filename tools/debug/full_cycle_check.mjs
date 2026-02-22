#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const defaultApiPrefix = '/api/v1';

function nowIso() {
  return new Date().toISOString();
}

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.FULL_CYCLE_BASE_URL || process.env.API_BASE_URL,
    token: process.env.FULL_CYCLE_TOKEN || process.env.API_TOKEN,
    timeoutMs: Number(process.env.FULL_CYCLE_TG_TIMEOUT_MS || 45000),
    pollMs: Number(process.env.FULL_CYCLE_POLL_MS || 3000),
    strictTelegram: (process.env.FULL_CYCLE_STRICT_TG || 'true') !== 'false',
    logFile:
      process.env.FULL_CYCLE_LOG ||
      path.resolve(process.cwd(), `logs/full-cycle-${Date.now()}.jsonl`),
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--base-url' && next) {
      args.baseUrl = next;
      i += 1;
    } else if (arg === '--token' && next) {
      args.token = next;
      i += 1;
    } else if (arg === '--timeout-ms' && next) {
      args.timeoutMs = Number(next);
      i += 1;
    } else if (arg === '--poll-ms' && next) {
      args.pollMs = Number(next);
      i += 1;
    } else if (arg === '--log-file' && next) {
      args.logFile = path.resolve(process.cwd(), next);
      i += 1;
    } else if (arg === '--strict-telegram') {
      args.strictTelegram = true;
    } else if (arg === '--soft-telegram') {
      args.strictTelegram = false;
    } else if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  if (!args.baseUrl || !args.token) {
    printHelp();
    throw new Error(
      'Нужно указать --base-url и --token (или переменные окружения).',
    );
  }
  return args;
}

function printHelp() {
  console.log(`Использование:
  node tools/debug/full_cycle_check.mjs --base-url https://host --token <JWT>

Опции:
  --timeout-ms <number>   Таймаут ожидания Telegram-публикации (по умолчанию 45000)
  --poll-ms <number>      Интервал опроса (по умолчанию 3000)
  --log-file <path>       Файл логов jsonl
  --strict-telegram       Считать отсутствие Telegram-метаданных ошибкой (по умолчанию)
  --soft-telegram         Отмечать отсутствие Telegram-метаданных как предупреждение

ENV:
  FULL_CYCLE_BASE_URL, FULL_CYCLE_TOKEN, FULL_CYCLE_TG_TIMEOUT_MS,
  FULL_CYCLE_POLL_MS, FULL_CYCLE_STRICT_TG, FULL_CYCLE_LOG
`);
}

class StageLogger {
  constructor(logFile) {
    this.logFile = logFile;
  }

  async init() {
    await fs.mkdir(path.dirname(this.logFile), { recursive: true });
    await fs.writeFile(this.logFile, '');
  }

  async log(event) {
    const line = `${JSON.stringify({ ts: nowIso(), ...event })}\n`;
    await fs.appendFile(this.logFile, line, 'utf8');
    const mark =
      event.level === 'error' ? '✖' : event.level === 'warn' ? '⚠' : '✔';
    console.log(`${mark} [${event.stage}] ${event.message}`);
  }
}

function createAuthHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function extractFileId(url) {
  if (typeof url !== 'string') return null;
  const match = url.match(/\/api\/v1\/files\/([^/?#]+)/);
  return match?.[1] ?? null;
}

async function httpJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { response, text, json };
}

async function createFixtures(tempDir) {
  await fs.mkdir(tempDir, { recursive: true });
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlB2X8AAAAASUVORK5CYII=';

  const files = [
    [
      'sample.txt',
      'text/plain',
      Buffer.from('full cycle check text file\n', 'utf8'),
    ],
    [
      'sample.pdf',
      'application/pdf',
      Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'),
    ],
    [
      'sample.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      Buffer.from('PK\x03\x04dummy-xlsx', 'utf8'),
    ],
    ['sample.mp4', 'video/mp4', Buffer.from('00000020667479706d703432', 'hex')],
    ['sample.jpg', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xd9])],
    ['sample.png', 'image/png', Buffer.from(pngBase64, 'base64')],
  ];

  const prepared = [];
  for (const [name, mime, content] of files) {
    const filePath = path.join(tempDir, name);
    await fs.writeFile(filePath, content);
    prepared.push({ filePath, name, mime });
  }
  return prepared;
}

async function main() {
  const args = parseArgs(process.argv);
  const logger = new StageLogger(args.logFile);
  await logger.init();

  const state = {
    taskId: null,
    fileIds: [],
    tmpDir: await fs.mkdtemp(path.join(os.tmpdir(), 'erm-full-cycle-')),
  };

  const apiRoot = new URL(defaultApiPrefix, args.baseUrl)
    .toString()
    .replace(/\/$/, '');

  try {
    await logger.log({
      stage: 'setup',
      level: 'info',
      message: `Временная папка: ${state.tmpDir}`,
    });
    const fixtures = await createFixtures(state.tmpDir);
    await logger.log({
      stage: 'prepare_fixtures',
      level: 'info',
      message: `Подготовлено файлов: ${fixtures.length}`,
      details: fixtures.map((f) => ({ name: f.name, mime: f.mime })),
    });

    const form = new FormData();
    form.set('title', `Full cycle check ${Date.now()}`);
    form.set(
      'task_description',
      'Автотест полного цикла с вложениями и проверкой Telegram-метаданных',
    );
    for (const fixture of fixtures) {
      const bytes = await fs.readFile(fixture.filePath);
      form.append(
        'files',
        new Blob([bytes], { type: fixture.mime }),
        fixture.name,
      );
    }

    const create = await httpJson(`${apiRoot}/tasks`, {
      method: 'POST',
      headers: createAuthHeaders(args.token),
      body: form,
    });

    if (!create.response.ok || !create.json?._id) {
      throw new Error(
        `Создание задачи провалено: HTTP ${create.response.status} ${create.text}`,
      );
    }

    state.taskId = create.json._id;
    state.fileIds = (
      Array.isArray(create.json.attachments) ? create.json.attachments : []
    )
      .map((item) => extractFileId(item?.url))
      .filter(Boolean);

    await logger.log({
      stage: 'create_task',
      level: 'info',
      message: `Задача создана: ${state.taskId}; вложений: ${state.fileIds.length}`,
    });

    let tgVerified = false;
    const started = Date.now();
    while (Date.now() - started < args.timeoutMs) {
      const details = await httpJson(`${apiRoot}/tasks/${state.taskId}`, {
        headers: createAuthHeaders(args.token),
      });
      if (!details.response.ok || !details.json?.task) {
        await logger.log({
          stage: 'telegram_check',
          level: 'warn',
          message: `Не удалось получить задачу на проверке Telegram: HTTP ${details.response.status}`,
        });
        await new Promise((r) => setTimeout(r, args.pollMs));
        continue;
      }
      const task = details.json.task;
      const hasTelegramSignals =
        Number.isFinite(task.telegram_message_id) ||
        Number.isFinite(task.telegram_topic_id) ||
        (Array.isArray(task.telegram_dm_message_ids) &&
          task.telegram_dm_message_ids.length > 0);
      if (hasTelegramSignals) {
        tgVerified = true;
        await logger.log({
          stage: 'telegram_check',
          level: 'info',
          message: `Telegram-метаданные найдены (message/topic/dm): ok`,
          details: {
            telegram_message_id: task.telegram_message_id ?? null,
            telegram_topic_id: task.telegram_topic_id ?? null,
            telegram_dm_message_ids: task.telegram_dm_message_ids ?? [],
          },
        });
        break;
      }
      await new Promise((r) => setTimeout(r, args.pollMs));
    }

    if (!tgVerified) {
      const level = args.strictTelegram ? 'error' : 'warn';
      await logger.log({
        stage: 'telegram_check',
        level,
        message: `Telegram-метаданные не появились за ${args.timeoutMs}ms`,
      });
      if (args.strictTelegram) {
        throw new Error(
          'Не подтверждена публикация задачи в Telegram в отведённый таймаут.',
        );
      }
    }

    const del = await fetch(`${apiRoot}/tasks/${state.taskId}`, {
      method: 'DELETE',
      headers: createAuthHeaders(args.token),
    });
    if (del.status !== 204) {
      const body = await del.text();
      throw new Error(`Удаление задачи провалено: HTTP ${del.status} ${body}`);
    }
    await logger.log({
      stage: 'delete_task',
      level: 'info',
      message: `Задача удалена: ${state.taskId}`,
    });

    const verifyDeleted = await fetch(`${apiRoot}/tasks/${state.taskId}`, {
      headers: createAuthHeaders(args.token),
    });
    if (verifyDeleted.status !== 404) {
      const body = await verifyDeleted.text();
      throw new Error(
        `Проверка удаления задачи не прошла: HTTP ${verifyDeleted.status} ${body}`,
      );
    }
    await logger.log({
      stage: 'verify_task_deleted',
      level: 'info',
      message: 'Проверка 404 после удаления: ok',
    });

    for (const fileId of state.fileIds) {
      const fileRes = await fetch(`${apiRoot}/files/${fileId}`, {
        headers: createAuthHeaders(args.token),
      });
      await logger.log({
        stage: 'verify_files_cleanup',
        level: fileRes.status === 404 ? 'info' : 'warn',
        message:
          fileRes.status === 404
            ? `Файл ${fileId} удалён (404)`
            : `Файл ${fileId} всё ещё доступен (HTTP ${fileRes.status})`,
      });
    }

    await logger.log({
      stage: 'finish',
      level: 'info',
      message: 'Full cycle check завершён успешно',
    });
  } finally {
    try {
      if (state.tmpDir) {
        await fs.rm(state.tmpDir, { recursive: true, force: true });
        await logger.log({
          stage: 'cleanup_local',
          level: 'info',
          message: 'Временные тестовые файлы удалены',
        });
      }
    } catch (error) {
      await logger.log({
        stage: 'cleanup_local',
        level: 'warn',
        message: `Не удалось удалить временные файлы: ${error.message}`,
      });
    }
    console.log(`Логи: ${args.logFile}`);
  }
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exitCode = 1;
});
