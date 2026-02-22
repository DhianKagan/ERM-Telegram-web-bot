import type { Request } from 'express';
import { generateShortToken } from '../auth/auth';
import { ACCESS_MANAGER, ACCESS_TASK_DELETE } from '../utils/accessMask';
import type { RequestWithUser } from '../types/request';

export type FullCycleStage =
  | 'setup'
  | 'prepare_fixtures'
  | 'create_task'
  | 'telegram_check'
  | 'delete_task'
  | 'verify_task_deleted'
  | 'verify_files_cleanup'
  | 'finish';

export type FullCycleLogEntry = {
  ts: string;
  stage: FullCycleStage;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
};

export type FullCycleCheckReport = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  taskId?: string;
  fileIds: string[];
  logs: FullCycleLogEntry[];
};

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_POLL_MS = 3_000;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const nowIso = (): string => new Date().toISOString();

const extractFileId = (url: unknown): string | null => {
  if (typeof url !== 'string') return null;
  const match = url.match(/\/api\/v1\/files\/([^/?#]+)/);
  return match?.[1] ?? null;
};

const createFixtures = (): Array<{
  name: string;
  mime: string;
  data: Buffer;
}> => {
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlB2X8AAAAASUVORK5CYII=';

  return [
    {
      name: 'sample.txt',
      mime: 'text/plain',
      data: Buffer.from('full cycle check text file\n', 'utf8'),
    },
    {
      name: 'sample.pdf',
      mime: 'application/pdf',
      data: Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n',
      ),
    },
    {
      name: 'sample.xlsx',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: Buffer.from('PK\x03\x04dummy-xlsx', 'utf8'),
    },
    {
      name: 'sample.mp4',
      mime: 'video/mp4',
      data: Buffer.from('00000020667479706d703432', 'hex'),
    },
    {
      name: 'sample.jpg',
      mime: 'image/jpeg',
      data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    },
    {
      name: 'sample.png',
      mime: 'image/png',
      data: Buffer.from(pngBase64, 'base64'),
    },
  ];
};

const getBearerToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    return token.length > 0 ? token : null;
  }
  return null;
};

const resolveTaskApiToken = (
  req: Request,
): { token: string; source: 'bearer' | 'elevated_admin' } => {
  const bearerToken = getBearerToken(req);
  const user = (req as RequestWithUser).user;
  const hasTaskDeleteAccess =
    typeof user?.access === 'number' &&
    (user.access & ACCESS_TASK_DELETE) === ACCESS_TASK_DELETE;

  if (bearerToken && hasTaskDeleteAccess) {
    return { token: bearerToken, source: 'bearer' };
  }

  if (
    user &&
    (typeof user.id === 'string' || typeof user.id === 'number') &&
    typeof user.username === 'string' &&
    typeof user.role === 'string'
  ) {
    return {
      token: generateShortToken({
        id: user.id,
        username: user.username,
        role: user.role,
        access: Number(user.access ?? 0) | ACCESS_MANAGER | ACCESS_TASK_DELETE,
      }),
      source: 'elevated_admin',
    };
  }

  if (bearerToken) {
    return { token: bearerToken, source: 'bearer' };
  }

  throw new Error(
    'Не удалось получить токен для выполнения full-cycle проверки.',
  );
};

const resolveBaseUrl = (req: Request): string => {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol =
    typeof forwardedProto === 'string' && forwardedProto.length > 0
      ? forwardedProto.split(',')[0].trim()
      : req.protocol;
  const host = req.get('host');
  return `${protocol || 'http'}://${host || 'localhost:3000'}`;
};

const createLogger = (logs: FullCycleLogEntry[]) => {
  return (
    stage: FullCycleStage,
    level: FullCycleLogEntry['level'],
    message: string,
    details?: Record<string, unknown>,
  ) => {
    logs.push({
      ts: nowIso(),
      stage,
      level,
      message,
      ...(details ? { details } : {}),
    });
  };
};

const tryParseJson = (value: string): Record<string, unknown> | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

export async function runFullCycleCheck(
  req: Request,
  options?: {
    timeoutMs?: number;
    pollMs?: number;
    strictTelegram?: boolean;
  },
): Promise<FullCycleCheckReport> {
  const startedAt = nowIso();
  const logs: FullCycleLogEntry[] = [];
  const log = createLogger(logs);
  const timeoutMs = Math.max(
    3_000,
    Number(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  );
  const pollMs = Math.max(1_000, Number(options?.pollMs ?? DEFAULT_POLL_MS));
  const strictTelegram = options?.strictTelegram !== false;
  const { token, source: tokenSource } = resolveTaskApiToken(req);

  const baseUrl = resolveBaseUrl(req);
  const apiRoot = new URL('/api/v1', baseUrl).toString().replace(/\/$/, '');
  const fileIds: string[] = [];
  let taskId: string | undefined;

  try {
    log('setup', 'info', 'Старт full-cycle проверки', {
      baseUrl,
      timeoutMs,
      pollMs,
      strictTelegram,
      tokenSource,
    });

    const fixtures = createFixtures();
    log('prepare_fixtures', 'info', `Подготовлено файлов: ${fixtures.length}`, {
      files: fixtures.map((file) => ({ name: file.name, mime: file.mime })),
    });

    const createBody = new FormData();
    createBody.set('title', `Full cycle check ${Date.now()}`);
    createBody.set(
      'task_description',
      'Автотест полного цикла: вложения + Telegram + очистка',
    );

    for (const fixture of fixtures) {
      createBody.append(
        'files',
        new Blob([new Uint8Array(fixture.data)], { type: fixture.mime }),
        fixture.name,
      );
    }

    const createResponse = await fetch(`${apiRoot}/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: createBody,
    });
    const createText = await createResponse.text();
    const createPayload = tryParseJson(createText);

    taskId =
      typeof createPayload?._id === 'string' ? createPayload._id : undefined;

    if (!createResponse.ok || !taskId) {
      log('create_task', 'error', 'Не удалось создать задачу', {
        status: createResponse.status,
        body: createText,
      });
      throw new Error('Этап create_task завершился ошибкой');
    }

    const attachments = Array.isArray(createPayload?.attachments)
      ? (createPayload?.attachments as Array<Record<string, unknown>>)
      : [];
    for (const attachment of attachments) {
      const fileId = extractFileId(attachment?.url);
      if (fileId) fileIds.push(fileId);
    }

    log('create_task', 'info', `Задача создана: ${taskId}`, {
      attachments: attachments.length,
      fileIds,
    });

    let telegramReady = false;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const taskResponse = await fetch(`${apiRoot}/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const taskText = await taskResponse.text();
      const taskPayload = tryParseJson(taskText);
      const task = taskPayload?.task as Record<string, unknown> | undefined;

      if (!taskResponse.ok || !task) {
        log(
          'telegram_check',
          'warn',
          `Не удалось прочитать задачу при опросе Telegram (HTTP ${taskResponse.status})`,
        );
        await wait(pollMs);
        continue;
      }

      const hasTelegramSignal =
        Number.isFinite(task.telegram_message_id as number) ||
        Number.isFinite(task.telegram_topic_id as number) ||
        (Array.isArray(task.telegram_dm_message_ids) &&
          task.telegram_dm_message_ids.length > 0);

      if (hasTelegramSignal) {
        telegramReady = true;
        log('telegram_check', 'info', 'Найдены Telegram-метаданные задачи', {
          telegram_message_id: task.telegram_message_id ?? null,
          telegram_topic_id: task.telegram_topic_id ?? null,
          telegram_dm_message_ids: task.telegram_dm_message_ids ?? [],
        });
        break;
      }

      await wait(pollMs);
    }

    if (!telegramReady) {
      log(
        'telegram_check',
        strictTelegram ? 'error' : 'warn',
        `Telegram-метаданные не появились за ${timeoutMs}ms`,
      );
      if (strictTelegram) {
        throw new Error('Этап telegram_check завершился ошибкой');
      }
    }

    const deleteResponse = await fetch(`${apiRoot}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const deleteText = await deleteResponse.text();
    if (deleteResponse.status !== 204) {
      log('delete_task', 'error', 'Не удалось удалить задачу', {
        status: deleteResponse.status,
        body: deleteText,
      });
      throw new Error('Этап delete_task завершился ошибкой');
    }

    const deletedTaskId = taskId;
    log('delete_task', 'info', `Задача удалена: ${deletedTaskId}`);
    taskId = undefined;

    const checkDeletedResponse = await fetch(
      `${apiRoot}/tasks/${deletedTaskId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (checkDeletedResponse.status !== 404) {
      log(
        'verify_task_deleted',
        'error',
        `Ожидали 404 после удаления, получили ${checkDeletedResponse.status}`,
      );
      throw new Error('Этап verify_task_deleted завершился ошибкой');
    }

    log('verify_task_deleted', 'info', 'Подтверждено удаление задачи (404)');

    for (const fileId of fileIds) {
      const fileResponse = await fetch(`${apiRoot}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      log(
        'verify_files_cleanup',
        fileResponse.status === 404 ? 'info' : 'warn',
        fileResponse.status === 404
          ? `Файл ${fileId} удалён`
          : `Файл ${fileId} остался доступен (HTTP ${fileResponse.status})`,
      );
    }

    log('finish', 'info', 'Full-cycle проверка завершена');

    return {
      ok: true,
      startedAt,
      finishedAt: nowIso(),
      fileIds,
      logs,
    };
  } catch (error) {
    if (taskId) {
      try {
        await fetch(`${apiRoot}/tasks/${taskId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        log(
          'delete_task',
          'warn',
          `Rollback: удалили задачу ${taskId} после ошибки`,
        );
      } catch (rollbackError) {
        log('delete_task', 'error', 'Rollback удаления задачи не удался', {
          error:
            rollbackError instanceof Error
              ? rollbackError.message
              : String(rollbackError),
        });
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    log('finish', 'error', message);

    return {
      ok: false,
      startedAt,
      finishedAt: nowIso(),
      taskId,
      fileIds,
      logs,
    };
  }
}

export default { runFullCycleCheck };
